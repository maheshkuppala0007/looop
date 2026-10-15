const { query: pgQuery } = require('../config/postgres');

/**
 * Parses time range string into a Date filter
 */
const getStartDateForRange = (range = '30d') => {
  const now = new Date();
  switch (range.toLowerCase()) {
    case '7d':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case '30d':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case '90d':
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    case '12m':
      return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    case 'all':
      return new Date(0);
    default:
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }
};

const dashboardCache = new Map();
const CACHE_TTL_MS = 30000; // 30-second cache TTL
const inflightPromises = new Map();

const invalidateDashboardCache = () => {
  dashboardCache.clear();
  inflightPromises.clear();
};

/**
 * Returns comprehensive real PostgreSQL statistics for the admin dashboard
 */
const getDashboardOverview = async (range = '30d') => {
  const cacheKey = `dashboard_${range.toLowerCase()}`;
  const now = Date.now();

  const cached = dashboardCache.get(cacheKey);
  if (cached && (now - cached.timestamp) < CACHE_TTL_MS) {
    return cached.data;
  }

  // Deduplicate simultaneous requests
  if (inflightPromises.has(cacheKey)) {
    return inflightPromises.get(cacheKey);
  }

  const promise = (async () => {
    const startDate = getStartDateForRange(range);

    // 1. Consolidated single query for ALL scalar metrics in 1 network round-trip
    const metricsSql = `
      SELECT
        (SELECT COUNT(*)::int FROM users) AS "totalUsers",
        (SELECT COUNT(*)::int FROM users WHERE LOWER(role) = 'customer') AS "totalCustomers",
        (SELECT COUNT(*)::int FROM users WHERE LOWER(role) = 'admin') AS "totalAdmins",
        (SELECT COUNT(*)::int FROM users WHERE account_status = 'active') AS "activeUsers",
        (SELECT COUNT(*)::int FROM users WHERE created_at >= $1) AS "newUsersInPeriod",
        (SELECT COUNT(*)::int FROM items) AS "totalItems",
        (SELECT COUNT(*)::int FROM items WHERE availability = 'Available' AND status = 'active') AS "availableItems",
        (SELECT COUNT(*)::int FROM items WHERE status IN ('pending_approval', 'pending_review', 'pending')) AS "pendingItems",
        (SELECT COUNT(*)::int FROM items WHERE created_at >= $1) AS "newItemsInPeriod",
        (SELECT COUNT(*)::int FROM wanted_items WHERE status = 'ACTIVE') AS "activeWantedItems",
        (SELECT COUNT(*)::int FROM requests WHERE status = 'PENDING') AS "pendingRequests",
        (SELECT COUNT(*)::int FROM transactions WHERE status IN ('PENDING_HANDOVER', 'HANDOVER_SCHEDULED', 'HANDED_OVER', 'ACTIVE', 'RETURN_PENDING')) AS "activeTransactions",
        (SELECT COUNT(*)::int FROM transactions WHERE status = 'COMPLETED') AS "completedTransactions",
        (SELECT COUNT(*)::int FROM transactions WHERE status = 'COMPLETED' AND completed_at >= $1) AS "completedInPeriod",
        (SELECT COUNT(*)::int FROM reports WHERE status IN ('PENDING', 'REVIEWED')) AS "openReports",
        (SELECT COUNT(*)::int FROM reviews) AS "totalReviews",
        (SELECT COUNT(*)::int FROM reward_orders WHERE status IN ('ORDER_PLACED', 'CONFIRMED', 'PROCESSING')) AS "pendingRewardOrders";
    `;

    const catSql = `SELECT category, COUNT(*)::int as count FROM items WHERE status = 'active' GROUP BY category ORDER BY count DESC LIMIT 8;`;
    const typeSql = `SELECT sharing_type as type, COUNT(*)::int as count FROM items WHERE status = 'active' GROUP BY sharing_type ORDER BY count DESC;`;
    const reportsSql = `
      SELECT 
        r.id, r.reporter_id AS "reporterId", r.target_type AS "targetType", 
        r.target_user_id AS "targetUserId", r.target_item_id AS "targetItemId", 
        r.reason, r.description, r.status, r.created_at AS "createdAt",
        json_build_object('name', COALESCE(u.name, 'Member'), 'email', COALESCE(u.email, '')) as reporter
      FROM reports r
      LEFT JOIN users u ON r.reporter_id = u.id
      WHERE r.status IN ('PENDING', 'REVIEWED')
      ORDER BY r.created_at DESC LIMIT 5;
    `;
    const auditSql = `
      SELECT a.*, u.name as admin_name, u.email as admin_email, u.avatar as admin_avatar
      FROM admin_audit_logs a
      LEFT JOIN users u ON a.admin_id = u.id
      ORDER BY a.created_at DESC LIMIT 5;
    `;

    const [metricsRes, catRes, typeRes, reportsRes, auditRes] = await Promise.all([
      pgQuery(metricsSql, [startDate]).catch(err => {
        console.error('[Dashboard] Metrics SQL error:', err.message);
        return { rows: [{}] };
      }),
      pgQuery(catSql).catch(() => ({ rows: [] })),
      pgQuery(typeSql).catch(() => ({ rows: [] })),
      pgQuery(reportsSql).catch(() => ({ rows: [] })),
      pgQuery(auditSql).catch(() => ({ rows: [] }))
    ]);

    const m = metricsRes.rows[0] || {};
    const totalUsers = m.totalUsers ?? 0;
    const totalCustomers = m.totalCustomers ?? 0;
    const totalAdmins = m.totalAdmins ?? 0;
    const activeUsers = m.activeUsers ?? 0;
    const newUsersInPeriod = m.newUsersInPeriod ?? 0;
    const totalItems = m.totalItems ?? 0;
    const availableItems = m.availableItems ?? 0;
    const newItemsInPeriod = m.newItemsInPeriod ?? 0;
    const activeWantedItems = m.activeWantedItems ?? 0;
    const pendingRequests = m.pendingRequests ?? 0;
    const activeTransactions = m.activeTransactions ?? 0;
    const completedTransactions = m.completedTransactions ?? 0;
    const completedInPeriod = m.completedInPeriod ?? 0;
    const openReports = m.openReports ?? 0;
    const totalReviews = m.totalReviews ?? 0;

    const categoryDistribution = (catRes.rows || []).map(r => ({
      category: r.category || 'other',
      count: r.count || 0
    }));

    const sharingTypeDistribution = (typeRes.rows || []).map(r => ({
      type: r.type || 'give_away',
      count: r.count || 0
    }));

    const urgentReports = (reportsRes.rows || []).map(r => ({
      _id: r.id,
      id: r.id,
      reason: r.reason,
      status: r.status,
      targetType: r.targetType,
      createdAt: r.createdAt,
      reporter: r.reporter || { name: 'Member', email: '' }
    }));

    const recentAuditLogs = (auditRes.rows || []).map(log => ({
      _id: log.id,
      id: log.id,
      action: log.action,
      targetType: log.target_type,
      targetId: log.target_id,
      targetTitle: log.target_title,
      metadata: log.metadata,
      createdAt: log.created_at,
      admin: {
        name: log.admin_name || 'System Admin',
        email: log.admin_email || '',
        avatar: log.admin_avatar || ''
      }
    }));

    // Calculate platform completion rate
    const totalCompletedOrCancelled = (completedTransactions + openReports) || 1;
    const completionRate = completedTransactions > 0
      ? Math.round((completedTransactions / totalCompletedOrCancelled) * 100)
      : 0;

    const result = {
      metrics: {
        totalUsers,
        totalCustomers,
        totalAdmins,
        activeUsers,
        totalItems,
        availableItems,
        pendingItems: m.pendingItems ?? 0,
        pendingRewardOrders: m.pendingRewardOrders ?? 0,
        activeWantedItems,
        pendingRequests,
        activeTransactions,
        completedTransactions,
        openReports,
        totalReviews,
        completionRate
      },
      periodMetrics: {
        range,
        newUsers: newUsersInPeriod,
        newItems: newItemsInPeriod,
        completedTransactions: completedInPeriod
      },
      distributions: {
        categories: categoryDistribution,
        sharingTypes: sharingTypeDistribution
      },
      urgentReports,
      recentAuditLogs
    };

    dashboardCache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  })();

  inflightPromises.set(cacheKey, promise);
  try {
    return await promise;
  } finally {
    inflightPromises.delete(cacheKey);
  }
};

module.exports = {
  getDashboardOverview,
  getStartDateForRange,
  invalidateDashboardCache
};

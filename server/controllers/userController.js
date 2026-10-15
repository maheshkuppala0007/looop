const mongoose = require('mongoose');
const User = require('../models/User');
const Item = require('../models/Item');
const Transaction = require('../models/Transaction');
const Review = require('../models/Review');
const WantedItem = require('../models/WantedItem');
const { query: pgQuery } = require('../config/postgres');

/**
 * Sanitizer utility to prevent script injection in text fields
 */
const sanitizeText = (str) => {
  if (typeof str !== 'string') return '';
  return str
    .replace(/<[^>]*>/g, '') // remove HTML tags
    .trim();
};

/**
 * Deterministically compute profile completion percentage
 * based strictly on real profile fields.
 */
const calculateProfileCompletion = (user) => {
  const steps = [];

  // 1. Name present and valid
  const hasName = !!user.name && user.name.trim().length >= 2;
  steps.push({ field: 'name', label: 'Full Name', completed: hasName, weight: 20 });

  // 2. Avatar set (not empty and not default blank)
  const hasAvatar = !!user.avatar && user.avatar.trim().length > 0;
  steps.push({ field: 'avatar', label: 'Profile Photo', completed: hasAvatar, weight: 20 });

  // 3. Bio written (at least 10 chars)
  const hasBio = !!user.bio && user.bio.trim().length >= 10;
  steps.push({ field: 'bio', label: 'About Me / Bio', completed: hasBio, weight: 20 });

  // 4. Location provided (city and state)
  const hasLocation = !!user.city && !!user.state && user.city.trim().length > 0 && user.state.trim().length > 0;
  steps.push({ field: 'location', label: 'City & State', completed: hasLocation, weight: 20 });

  // 5. At least one community interest listed
  const hasInterests = Array.isArray(user.interests) && user.interests.length > 0;
  steps.push({ field: 'interests', label: 'Sharing Interests', completed: hasInterests, weight: 20 });

  const percentage = steps.reduce((sum, step) => (step.completed ? sum + step.weight : sum), 0);

  return {
    percentage,
    steps
  };
};

/**
 * Safe public user serializer.
 * Strips all sensitive information: email, password, phone, exact address, security metadata.
 */
const toPublicUser = (user) => {
  if (!user) return null;
  const userObj = user.toObject ? user.toObject() : user;

  return {
    id: userObj._id,
    _id: userObj._id,
    name: userObj.name,
    avatar: userObj.avatar || '',
    bio: userObj.bio || '',
    city: userObj.city || '',
    state: userObj.state || '',
    interests: userObj.interests || [],
    memberSince: userObj.createdAt,
    createdAt: userObj.createdAt,
    verified: !!userObj.verified,
    profileVisibility: userObj.profileVisibility || 'public',
    rating: userObj.rating || 0,
    reviewsCount: userObj.reviewsCount || 0
  };
};

/**
 * 1. Get current logged-in user profile with real database stats
 * GET /api/users/me
 */
exports.getMe = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const userEmail = req.user?.email;

    if (!userId && !userEmail) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    let user = null;
    let safeUser = null;

    // 1. Check Neon PostgreSQL first
    try {
      const pgUserRes = await pgQuery(
        `SELECT id, name, email, role, avatar, bio, city, locality, state,
                account_status AS "accountStatus", trust_score AS "trustScore",
                rating, reviews_count AS "reviewsCount", verified, created_at AS "createdAt"
         FROM users
         WHERE id = $1 OR email = $2 LIMIT 1;`,
        [userId || '', userEmail || '']
      );

      if (pgUserRes?.rows?.[0]) {
        const pgUser = pgUserRes.rows[0];
        const targetId = pgUser.id;

        // Fetch real Neon PG counts concurrently with individual catch protection
        const [
          activeItemsRes,
          itemsSharedRes,
          completedTxRes,
          wantedRes,
          reviewsRes,
          reviewAggRes
        ] = await Promise.all([
          pgQuery("SELECT COUNT(*)::int as count FROM items WHERE owner_id = $1 AND (availability = 'Available' OR status = 'active');", [targetId]).catch(() => ({ rows: [{ count: 0 }] })),
          pgQuery("SELECT COUNT(*)::int as count FROM items WHERE owner_id = $1;", [targetId]).catch(() => ({ rows: [{ count: 0 }] })),
          pgQuery("SELECT COUNT(*)::int as count FROM transactions WHERE (owner_id = $1 OR recipient_id = $1) AND status = 'COMPLETED';", [targetId]).catch(() => ({ rows: [{ count: 0 }] })),
          pgQuery("SELECT COUNT(*)::int as count FROM wanted_items WHERE requester_id = $1;", [targetId]).catch(() => ({ rows: [{ count: 0 }] })),
          pgQuery("SELECT COUNT(*)::int as count FROM reviews WHERE reviewee_id = $1;", [targetId]).catch(() => ({ rows: [{ count: 0 }] })),
          pgQuery("SELECT COALESCE(ROUND(AVG(rating)::numeric, 1), 0)::float as avg_rating, COUNT(*)::int as count FROM reviews WHERE reviewee_id = $1;", [targetId]).catch(() => ({ rows: [{ avg_rating: 0, count: 0 }] }))
        ]);

        const activeItemsCount = activeItemsRes?.rows?.[0]?.count || 0;
        const itemsSharedCount = itemsSharedRes?.rows?.[0]?.count || 0;
        const completedTransactionsCount = completedTxRes?.rows?.[0]?.count || 0;
        const wantedCount = wantedRes?.rows?.[0]?.count || 0;
        const reviewsReceivedCount = reviewsRes?.rows?.[0]?.count || 0;
        const averageRating = reviewAggRes?.rows?.[0]?.avg_rating || pgUser.rating || 0;

        safeUser = {
          _id: pgUser.id,
          id: pgUser.id,
          name: pgUser.name,
          email: pgUser.email,
          role: pgUser.role || 'customer',
          avatar: pgUser.avatar || '',
          bio: pgUser.bio || '',
          city: pgUser.city || '',
          locality: pgUser.locality || '',
          state: pgUser.state || '',
          accountStatus: pgUser.accountStatus || 'active',
          trustScore: pgUser.trustScore || 95,
          rating: averageRating,
          reviewsCount: reviewsReceivedCount,
          verified: pgUser.verified !== false,
          createdAt: pgUser.createdAt
        };

        const completion = calculateProfileCompletion(safeUser);

        return res.status(200).json({
          success: true,
          user: safeUser,
          stats: {
            activeItems: activeItemsCount,
            itemsShared: itemsSharedCount,
            completedTransactions: completedTransactionsCount,
            wantedRequests: wantedCount,
            reviewsReceived: reviewsReceivedCount,
            averageRating
          },
          profileCompletion: completion
        });
      }
    } catch (pgErr) {
      console.warn('[userController] getMe PG notice:', pgErr.message);
    }

    // 2. Fallback to MongoDB only if active
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      try {
        if (mongoose.Types.ObjectId.isValid(userId)) {
          user = await User.findById(userId).select('-password');
        }
        if (!user && userEmail) {
          user = await User.findOne({ email: userEmail }).select('-password');
        }
      } catch (mErr) {
        console.warn('[userController] getMe Mongo notice:', mErr.message);
      }
    }

    if (!user) {
      return res.status(404).json({ success: false, message: 'User profile not found.' });
    }

    const userObjectId = user._id;
    const [
      activeItemsCount,
      itemsSharedCount,
      completedTransactionsCount,
      wantedCount,
      reviewsReceivedCount,
      reviewAgg
    ] = await Promise.all([
      Item.countDocuments({ owner: userObjectId, status: 'AVAILABLE' }),
      Item.countDocuments({ owner: userObjectId }),
      Transaction.countDocuments({
        $or: [{ owner: userObjectId }, { recipient: userObjectId }],
        status: 'COMPLETED'
      }),
      WantedItem.countDocuments({ user: userObjectId }),
      Review.countDocuments({ reviewee: userObjectId }),
      Review.aggregate([
        { $match: { reviewee: userObjectId } },
        {
          $group: {
            _id: null,
            averageRating: { $avg: '$rating' },
            total: { $sum: 1 }
          }
        }
      ])
    ]);

    const averageRating = reviewAgg.length > 0 ? Math.round(reviewAgg[0].averageRating * 10) / 10 : 0;
    const completion = calculateProfileCompletion(user);

    safeUser = user.toObject();
    delete safeUser.password;

    return res.status(200).json({
      success: true,
      user: safeUser,
      stats: {
        activeItems: activeItemsCount,
        itemsShared: itemsSharedCount,
        completedTransactions: completedTransactionsCount,
        wantedRequests: wantedCount,
        reviewsReceived: reviewsReceivedCount,
        averageRating
      },
      profileCompletion: completion
    });
  } catch (error) {
    console.error('Error in getMe:', error);
    return res.status(500).json({
      success: false,
      message: 'Unable to retrieve user profile.'
    });
  }
};

/**
 * 2. Update current logged-in user profile
 * PATCH /api/users/me
 */
exports.updateMe = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const userEmail = req.user?.email;

    if (!userId && !userEmail) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const {
      name,
      bio,
      city,
      locality,
      state,
      interests,
      profileVisibility,
      avatar
    } = req.body;

    const cleanName = name !== undefined ? sanitizeText(name) : undefined;
    const cleanBio = bio !== undefined ? sanitizeText(bio) : undefined;
    const cleanCity = city !== undefined ? sanitizeText(city).slice(0, 80) : undefined;
    const cleanLocality = locality !== undefined ? sanitizeText(locality).slice(0, 100) : undefined;
    const cleanState = state !== undefined ? sanitizeText(state).slice(0, 80) : undefined;
    const cleanAvatar = avatar !== undefined && typeof avatar === 'string' ? avatar.trim() : undefined;

    // 1. Update Neon PostgreSQL Database
    let updatedPgUser = null;
    try {
      const updateRes = await pgQuery(
        `UPDATE users
         SET name = COALESCE($1::text, name),
             bio = COALESCE($2::text, bio),
             city = COALESCE($3::text, city),
             locality = COALESCE($4::text, locality),
             state = COALESCE($5::text, state),
             avatar = CASE WHEN $6::text IS NOT NULL THEN $6::text ELSE avatar END
         WHERE id = $7::text OR email = $8::text
         RETURNING id, name, email, role, avatar, bio, city, locality, state,
                   account_status AS "accountStatus", trust_score AS "trustScore",
                   rating, reviews_count AS "reviewsCount", verified, created_at AS "createdAt";`,
        [cleanName || null, cleanBio || null, cleanCity || null, cleanLocality || null, cleanState || null, cleanAvatar !== undefined ? cleanAvatar : null, userId || '', userEmail || '']
      );

      if (updateRes?.rows?.[0]) {
        updatedPgUser = updateRes.rows[0];
      }
    } catch (pgErr) {
      console.warn('[userController] updateMe PG notice:', pgErr.message);
    }

    // 2. Also Update Mongo User if exists
    let mongoUser = null;
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      if (mongoose.Types.ObjectId.isValid(userId)) {
        mongoUser = await User.findById(userId);
      }
      if (!mongoUser && userEmail) {
        mongoUser = await User.findOne({ email: userEmail });
      }
    }

    if (mongoUser) {
      if (cleanName) mongoUser.name = cleanName;
      if (cleanBio) mongoUser.bio = cleanBio;
      if (cleanCity) mongoUser.city = cleanCity;
      if (cleanLocality) mongoUser.locality = cleanLocality;
      if (cleanState) mongoUser.state = cleanState;
      if (cleanAvatar !== undefined) mongoUser.avatar = cleanAvatar;
      if (interests && Array.isArray(interests)) {
        mongoUser.interests = interests.map(i => sanitizeText(i)).filter(i => i.length > 0).slice(0, 15);
      }
      if (profileVisibility && ['public', 'community'].includes(profileVisibility)) {
        mongoUser.profileVisibility = profileVisibility;
      }
      await mongoUser.save();
    }

    const returnedUser = updatedPgUser
      ? {
          _id: updatedPgUser.id,
          id: updatedPgUser.id,
          name: updatedPgUser.name,
          email: updatedPgUser.email,
          role: updatedPgUser.role || 'customer',
          avatar: updatedPgUser.avatar || '',
          bio: updatedPgUser.bio || '',
          city: updatedPgUser.city || '',
          locality: updatedPgUser.locality || '',
          state: updatedPgUser.state || '',
          accountStatus: updatedPgUser.accountStatus || 'active',
          trustScore: updatedPgUser.trustScore || 95,
          rating: updatedPgUser.rating || 0,
          verified: updatedPgUser.verified !== false,
          createdAt: updatedPgUser.createdAt
        }
      : mongoUser
      ? mongoUser.toObject()
      : null;

    if (!returnedUser) {
      return res.status(404).json({ success: false, message: 'User profile not found.' });
    }

    if (returnedUser.password) delete returnedUser.password;

    const completion = calculateProfileCompletion(returnedUser);

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully.',
      user: returnedUser,
      profileCompletion: completion
    });
  } catch (error) {
    console.error('Error in updateMe:', error);
    return res.status(500).json({
      success: false,
      message: 'Unable to update profile. Please try again.'
    });
  }
};

/**
 * 3. Upload Profile Photo (WhatsApp DP Model)
 * POST /api/users/me/avatar
 */
exports.uploadAvatar = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const userEmail = req.user?.email;

    if (!userId && !userEmail) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    let avatarUrl = '';
    if (req.file) {
      avatarUrl = `/uploads/${req.file.filename}`;
    } else if (req.body?.avatar) {
      avatarUrl = String(req.body.avatar).trim();
    } else {
      return res.status(400).json({ success: false, message: 'No image file provided for profile photo.' });
    }

    // 1. Update Neon PostgreSQL Database
    let updatedPgUser = null;
    try {
      const updateRes = await pgQuery(
        `UPDATE users
         SET avatar = $1, updated_at = NOW()
         WHERE id = $2 OR email = $3
         RETURNING id, name, email, role, avatar, bio, city, locality, state,
                   account_status AS "accountStatus", trust_score AS "trustScore",
                   rating, reviews_count AS "reviewsCount", verified, created_at AS "createdAt";`,
        [avatarUrl, userId || '', userEmail || '']
      );

      if (updateRes?.rows?.[0]) {
        updatedPgUser = updateRes.rows[0];
      }
    } catch (pgErr) {
      console.warn('[userController] uploadAvatar PG notice:', pgErr.message);
    }

    // 2. Also Update Mongo User if active
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      try {
        if (mongoose.Types.ObjectId.isValid(userId)) {
          await User.findByIdAndUpdate(userId, { avatar: avatarUrl });
        } else if (userEmail) {
          await User.findOneAndUpdate({ email: userEmail }, { avatar: avatarUrl });
        }
      } catch (mErr) {
        console.warn('[userController] uploadAvatar Mongo notice:', mErr.message);
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Profile photo updated successfully.',
      avatar: avatarUrl,
      user: updatedPgUser || { id: userId, avatar: avatarUrl }
    });
  } catch (error) {
    console.error('Error in uploadAvatar:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to upload profile photo.'
    });
  }
};

/**
 * 3. Get Public Profile of any user
 * GET /api/users/:id
 */
exports.getPublicProfile = async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Query Neon PostgreSQL database
    try {
      const pgUserRes = await pgQuery(
        `SELECT id, name, email, role, avatar, bio, city, locality, state,
                account_status AS "accountStatus", trust_score AS "trustScore",
                rating, reviews_count AS "reviewsCount", verified, created_at AS "createdAt"
         FROM users WHERE id = $1 LIMIT 1;`,
        [id]
      );

      if (pgUserRes?.rows?.[0]) {
        const u = pgUserRes.rows[0];
        const [itemsRes, completedTxRes, itemsCountRes, reviewsRes] = await Promise.all([
          pgQuery(
            `SELECT id, title, images, category, condition, sharing_type AS "sharingType", city, locality, state, created_at AS "createdAt"
             FROM items WHERE owner_id = $1 AND (availability = 'Available' OR status = 'active') ORDER BY created_at DESC LIMIT 8;`,
            [id]
          ),
          pgQuery("SELECT COUNT(*)::int as count FROM transactions WHERE (owner_id = $1 OR recipient_id = $1) AND status = 'COMPLETED';", [id]),
          pgQuery("SELECT COUNT(*)::int as count FROM items WHERE owner_id = $1;", [id]),
          pgQuery("SELECT COALESCE(ROUND(AVG(rating)::numeric, 1), 0)::float as avg_rating, COUNT(*)::int as count FROM reviews WHERE reviewee_id = $1;", [id])
        ]);

        const publicItems = itemsRes?.rows || [];
        const completedTx = completedTxRes?.rows?.[0]?.count || 0;
        const totalItemsCount = itemsCountRes?.rows?.[0]?.count || 0;
        const avgRating = reviewsRes?.rows?.[0]?.avg_rating || u.rating || 0;
        const totalRev = reviewsRes?.rows?.[0]?.count || u.reviewsCount || 0;

        return res.status(200).json({
          success: true,
          isRestricted: false,
          user: {
            id: u.id,
            _id: u.id,
            name: u.name,
            avatar: u.avatar || '',
            bio: u.bio || '',
            city: u.city || '',
            state: u.state || '',
            memberSince: u.createdAt,
            createdAt: u.createdAt,
            verified: u.verified !== false,
            rating: avgRating,
            reviewsCount: totalRev
          },
          stats: {
            completedTransactions: completedTx,
            activeItems: publicItems.length,
            itemsShared: totalItemsCount,
            totalReviews: totalRev,
            averageRating: avgRating
          },
          reviewSummary: {
            averageRating: avgRating,
            totalReviews: totalRev,
            distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
          },
          publicItems: publicItems.map(item => ({
            id: item.id,
            _id: item.id,
            title: item.title,
            images: item.images || [],
            category: item.category,
            condition: item.condition,
            sharingType: item.sharingType,
            location: { city: item.city, locality: item.locality, state: item.state },
            createdAt: item.createdAt
          }))
        });
      }
    } catch (pgErr) {
      console.warn('[userController] getPublicProfile PG notice:', pgErr.message);
    }

    // 2. Fallback to MongoDB
    if (!mongoose.connection || mongoose.connection.readyState !== 1 || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const user = await User.findById(id).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const userObjectId = user._id;
    const [activeItems, completedTransactionsCount, itemsSharedCount, reviewAgg] = await Promise.all([
      Item.find({ owner: userObjectId, status: 'AVAILABLE' }).limit(8).catch(() => []),
      Transaction.countDocuments({ $or: [{ owner: userObjectId }, { recipient: userObjectId }], status: 'COMPLETED' }).catch(() => 0),
      Item.countDocuments({ owner: userObjectId }).catch(() => 0),
      Review.aggregate([{ $match: { reviewee: userObjectId } }, { $group: { _id: null, averageRating: { $avg: '$rating' }, total: { $sum: 1 } } }]).catch(() => [])
    ]);

    const averageRating = reviewAgg.length > 0 ? Math.round(reviewAgg[0].averageRating * 10) / 10 : 0;
    const totalReviews = reviewAgg.length > 0 ? reviewAgg[0].total : 0;

    return res.status(200).json({
      success: true,
      isRestricted: false,
      user: toPublicUser(user),
      stats: {
        completedTransactions: completedTransactionsCount,
        activeItems: activeItems.length,
        itemsShared: itemsSharedCount,
        totalReviews,
        averageRating
      },
      reviewSummary: { averageRating, totalReviews, distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 } },
      publicItems: activeItems.map(item => ({
        id: item._id,
        _id: item._id,
        title: item.title,
        images: item.images,
        category: item.category,
        condition: item.condition,
        sharingType: item.sharingType,
        location: item.location,
        createdAt: item.createdAt
      }))
    });
  } catch (error) {
    console.error('Error in getPublicProfile:', error);
    return res.status(500).json({
      success: false,
      message: 'Unable to retrieve member profile.'
    });
  }
};

module.exports = {
  ...exports,
  toPublicUser
};

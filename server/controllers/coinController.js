const coinLedgerService = require('../services/coinLedgerService');
const { query: pgQuery } = require('../config/postgres');

/**
 * Controller for Customer Coin Wallet & Ledger
 */
exports.getBalance = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }
    const balance = await coinLedgerService.getBalance(userId);
    return res.status(200).json({
      success: true,
      coins: balance.coins,
      points: balance.points,
      balance: balance.coins
    });
  } catch (error) {
    console.error('[coinController.getBalance] Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch coin balance.' });
  }
};

exports.getLedger = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }
    const { page = 1, limit = 20 } = req.query;
    const ledgerData = await coinLedgerService.getLedger({ userId, page, limit });
    return res.status(200).json({
      success: true,
      data: ledgerData
    });
  } catch (error) {
    console.error('[coinController.getLedger] Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch coin ledger.' });
  }
};

exports.getCoinDashboard = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const [balanceData, ledgerData] = await Promise.all([
      coinLedgerService.getBalance(userId),
      coinLedgerService.getLedger({ userId, page: 1, limit: 30 })
    ]);

    // Calculate totals earned and redeemed
    let totalEarned = 0;
    let totalRedeemed = 0;
    (ledgerData.history || []).forEach((entry) => {
      if (entry.amount > 0) {
        totalEarned += entry.amount;
      } else {
        totalRedeemed += Math.abs(entry.amount);
      }
    });

    return res.status(200).json({
      success: true,
      data: {
        coinsBalance: balanceData.coins,
        pointsBalance: balanceData.points,
        totalEarned,
        totalRedeemed,
        historyCount: ledgerData.total,
        history: ledgerData.history
      }
    });
  } catch (error) {
    console.error('[coinController.getCoinDashboard] Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch coin dashboard data.' });
  }
};

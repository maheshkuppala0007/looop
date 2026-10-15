const { query } = require('../config/postgres');

async function migrate() {
  console.log('[Migration] Creating site_reviews table...');
  await query(`
    CREATE TABLE IF NOT EXISTS site_reviews (
      id VARCHAR(64) PRIMARY KEY,
      person VARCHAR(120) NOT NULL,
      role VARCHAR(150) NOT NULL DEFAULT 'Community Member',
      item VARCHAR(150) DEFAULT 'Platform Experience',
      rating INT NOT NULL DEFAULT 5,
      quote TEXT NOT NULL,
      avatar TEXT DEFAULT 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
      badge VARCHAR(60) DEFAULT 'Verified Member',
      is_published BOOLEAN DEFAULT TRUE,
      display_order INT DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_site_reviews_published ON site_reviews(is_published, display_order ASC, created_at DESC);
  `);

  console.log('[Migration] Creating subscribers table...');
  await query(`
    CREATE TABLE IF NOT EXISTS subscribers (
      id VARCHAR(64) PRIMARY KEY,
      email VARCHAR(255) NOT NULL UNIQUE,
      name VARCHAR(120) DEFAULT 'Subscriber',
      verified BOOLEAN DEFAULT FALSE,
      status VARCHAR(30) DEFAULT 'ACTIVE',
      verification_otp VARCHAR(255),
      otp_expires_at TIMESTAMP WITH TIME ZONE,
      subscribed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      verified_at TIMESTAMP WITH TIME ZONE
    );
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_subscribers_email ON subscribers(email);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_subscribers_verified ON subscribers(verified, status);
  `);

  console.log('[Migration] Creating broadcast_updates table...');
  await query(`
    CREATE TABLE IF NOT EXISTS broadcast_updates (
      id VARCHAR(64) PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      category VARCHAR(60) DEFAULT 'Platform Update',
      message TEXT NOT NULL,
      recipient_count INT DEFAULT 0,
      sent_by VARCHAR(64) DEFAULT 'Admin',
      sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_broadcast_sent_at ON broadcast_updates(sent_at DESC);
  `);

  // Seed the 3 initial website-appreciating reviews
  const reviewCount = await query('SELECT COUNT(*) as count FROM site_reviews');
  if (parseInt(reviewCount.rows[0].count, 10) === 0) {
    console.log('[Migration] Seeding 3 website-appreciating reviews into site_reviews...');
    await query(`
      INSERT INTO site_reviews (id, person, role, item, rating, quote, avatar, badge, is_published, display_order)
      VALUES 
      (
        'srev_1',
        'Aarav Sharma',
        'Engineering Student · Indiranagar',
        'Seamless Platform Experience',
        5,
        'LOOOP completely transformed how our community shares resources! Instead of spending thousands on items I only need once, I found trustworthy neighbors ready to help. The secure handover code makes every transaction feel completely safe and professional.',
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
        'Verified Borrower',
        TRUE,
        1
      ),
      (
        'srev_2',
        'Ananya Deshmukh',
        'Graduating Senior · HSR Layout',
        'Circular Sustainability & Community',
        5,
        'This website is an absolute game-changer. LOOOP brings true circular reuse into daily life with zero sales pressure, zero commercial ads, and 100% verified trust. Watching real waste avoided in our neighborhood gives real meaning to sharing.',
        'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80',
        'Verified Sharer',
        TRUE,
        2
      ),
      (
        'srev_3',
        'Sunil Kumar',
        'Resident · JP Nagar Phase 3',
        'Neighborhood Connection & Trust',
        5,
        'I am genuinely impressed by how smoothly LOOOP works. My idle household tools and books are now helping students and families around me. High praise to Mahesh and the LOOOP team for building such a useful, clean, and honest platform!',
        'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=120&auto=format&fit=crop&q=80',
        'Top Contributor',
        TRUE,
        3
      );
    `);
    console.log('[Migration] 3 reviews inserted successfully.');
  }

  // Seed default site_config if not present
  const configRes = await query("SELECT id FROM admin_settings WHERE key = 'site_config' LIMIT 1");
  if (configRes.rows.length === 0) {
    console.log('[Migration] Seeding site_config in admin_settings...');
    const defaultSiteConfig = {
      siteName: 'LOOOP',
      siteTagline: 'Share. Reuse. Connect.',
      logoText: 'Looop',
      logoUrl: '',
      navLinks: [
        { id: 'home', label: 'Home', path: '/', visible: true },
        { id: 'browse', label: 'Browse Available Items', path: '/browse', visible: true },
        { id: 'how-it-works', label: 'How LOOOP Works', path: '/how-it-works', visible: true },
        { id: 'about', label: 'About the Mission', path: '/about', visible: true }
      ],
      impactSection: {
        title: 'Reducing Waste Through Circular Reuse',
        subtitle: 'Every item borrowed or gifted on LOOOP represents one less product manufactured, shipped in single-use plastic, or buried in a landfill.',
        badge: 'Verified Community Impact',
        customCards: [
          { id: 'customers', label: 'Customers', value: '10000+', desc: 'Active community members in the loop', visible: true }
        ],
        hiddenCards: []
      }
    };

    await query(
      `INSERT INTO admin_settings (id, key, value, label, description, category)
       VALUES ('setting_site_config', 'site_config', $1, 'Site Branding & Header CMS', 'Admin controls for logo, site title, nav links, and impact stats', 'CMS')`,
      [JSON.stringify(defaultSiteConfig)]
    );
    console.log('[Migration] site_config seeded.');
  }

  console.log('[Migration] All tables and seed data created successfully!');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('[Migration Error]', err);
  process.exit(1);
});

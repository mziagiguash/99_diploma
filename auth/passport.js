const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;

const db = require('../db/database');

// Сериализация
passport.serializeUser((user, done) => {
  done(null, user.id);
});


passport.deserializeUser(async (id, done) => {
  try {
    const result = await db.query('SELECT * FROM users WHERE id = $1', [id]);
    const user = result.rows[0];

    // 🛠️ Явно добавим userId в сессию для совместимости
    // passport сам этого не делает
    if (user) {
      user.userId = user.id; // для совместимости
    }

    done(null, user);
  } catch (err) {
    done(err);
  }
});

// === Google OAuth ===
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: '/auth/google/callback',
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const email = profile.emails?.[0]?.value;
    const result = await db.query('SELECT * FROM users WHERE username = $1', [email]);
    let user = result.rows[0];

    if (!user) {
      const insert = await db.query(
        'INSERT INTO users (username, password) VALUES ($1, $2) RETURNING *',
        [email, 'oauth_placeholder']
      );
      user = insert.rows[0];
    }

    done(null, user);
  } catch (err) {
    done(err);
  }
}));

// === GitHub OAuth ===
passport.use(new GitHubStrategy({
  clientID: process.env.GITHUB_CLIENT_ID,
  clientSecret: process.env.GITHUB_CLIENT_SECRET,
  callbackURL: '/auth/github/callback'
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const username = profile.username;
    const result = await db.query('SELECT * FROM users WHERE username = $1', [username]);
    let user = result.rows[0];

    if (!user) {
      const insert = await db.query(
        'INSERT INTO users (username, password) VALUES ($1, $2) RETURNING *',
        [username, 'oauth_placeholder']
      );
      user = insert.rows[0];
    }

    done(null, user);
  } catch (err) {
    done(err);
  }
}));

// === Facebook OAuth ===
passport.use(new FacebookStrategy({
  clientID: process.env.FACEBOOK_CLIENT_ID,
  clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
  callbackURL: '/auth/facebook/callback',
  profileFields: ['id', 'emails', 'name']
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const email = profile.emails?.[0]?.value || `fb_${profile.id}`;
    const result = await db.query('SELECT * FROM users WHERE username = $1', [email]);
    let user = result.rows[0];

    if (!user) {
      const insert = await db.query(
        'INSERT INTO users (username, password) VALUES ($1, $2) RETURNING *',
        [email, 'oauth_placeholder']
      );
      user = insert.rows[0];
    }

    done(null, user);
  } catch (err) {
    done(err);
  }
}));

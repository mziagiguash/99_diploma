const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;
const db = require('../db/database');

// Сериализация
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const result = await db.query('SELECT * FROM users WHERE id = $1', [id]);
    const user = result.rows[0];
    if (user) user.userId = user.id;
    done(null, user);
  } catch (err) {
    done(err);
  }
});

// Google
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: '/auth/google/callback',
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const email = profile.emails?.[0]?.value;
    let result = await db.query('SELECT * FROM users WHERE username = $1', [email]);
    let user = result.rows[0];

    if (!user) {
      result = await db.query(
        'INSERT INTO users (username, password) VALUES ($1, $2) RETURNING *',
        [email, 'oauth_placeholder']
      );
      user = result.rows[0];
    }

    done(null, user);
  } catch (err) {
    done(err);
  }
}));

// GitHub
passport.use(new GitHubStrategy({
  clientID: process.env.GITHUB_CLIENT_ID,
  clientSecret: process.env.GITHUB_CLIENT_SECRET,
  callbackURL: '/auth/github/callback',
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const username = profile.username;
    let result = await db.query('SELECT * FROM users WHERE username = $1', [username]);
    let user = result.rows[0];

    if (!user) {
      result = await db.query(
        'INSERT INTO users (username, password) VALUES ($1, $2) RETURNING *',
        [username, 'oauth_placeholder']
      );
      user = result.rows[0];
    }

    done(null, user);
  } catch (err) {
    done(err);
  }
}));

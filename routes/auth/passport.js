const express = require('express');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;
const db = require('../../db/database');
const { createDemoNoteIfNone } = require('../../utils/demoNote');

const router = express.Router();

// ===== Google OAuth =====
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: '/auth/google/callback',
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const email = profile.emails?.[0]?.value;
    if (!email) return done(new Error("Email not provided by Google"));

    let user = (await db.query('SELECT * FROM users WHERE username = $1', [email])).rows[0];
    if (!user) {
      user = (await db.query(
        'INSERT INTO users (username, password) VALUES ($1, $2) RETURNING *',
        [email, 'oauth_placeholder']
      )).rows[0];
    }

    done(null, user);
  } catch (err) {
    done(err);
  }
}));

// ===== GitHub OAuth =====
passport.use(new GitHubStrategy({
  clientID: process.env.GITHUB_CLIENT_ID,
  clientSecret: process.env.GITHUB_CLIENT_SECRET,
  callbackURL: '/auth/github/callback',
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const username = profile.username || profile.emails?.[0]?.value;
    if (!username) return done(new Error("Username not provided by GitHub"));

    let user = (await db.query('SELECT * FROM users WHERE username = $1', [username])).rows[0];
    if (!user) {
      user = (await db.query(
        'INSERT INTO users (username, password) VALUES ($1, $2) RETURNING *',
        [username, 'oauth_placeholder']
      )).rows[0];
    }

    done(null, user);
  } catch (err) {
    done(err);
  }
}));

// ===== Сессия =====
passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try {
    const user = (await db.query('SELECT * FROM users WHERE id = $1', [id])).rows[0];
    if (user) user.userId = user.id;
    done(null, user);
  } catch (err) {
    done(err);
  }
});

// ===== Routes =====
router.get('/google', passport.authenticate('google', { scope: ['email', 'profile'] }));
router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: '/' }),
  async (req, res) => {
    await createDemoNoteIfNone(req.user.id);
    res.redirect('/dashboard');
  }
);

router.get('/github', passport.authenticate('github', { scope: ['user:email'] }));
router.get('/github/callback',
  passport.authenticate('github', { failureRedirect: '/' }),
  async (req, res) => {
    await createDemoNoteIfNone(req.user.id);
    res.redirect('/dashboard');
  }
);

module.exports = router;

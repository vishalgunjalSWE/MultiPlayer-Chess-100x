const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GithubStrategy = require('passport-github2').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
import passport from 'passport';
import dotenv from 'dotenv';
import { db } from './db';

dotenv.config();
const GOOGLE_CLIENT_ID =
  process.env.GOOGLE_CLIENT_ID || 'your_google_client_id';
const GOOGLE_CLIENT_SECRET =
  process.env.GOOGLE_CLIENT_SECRET || 'your_google_client_secret';
const GITHUB_CLIENT_ID =
  process.env.GITHUB_CLIENT_ID || 'your_github_client_id';
const GITHUB_CLIENT_SECRET =
  process.env.GITHUB_CLIENT_SECRET || 'your_github_client_secret';
const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID || 'your_facebook_app_id';
const FACEBOOK_APP_SECRET =
  process.env.FACEBOOK_APP_SECRET || 'your_facebook_app_secret';

export function initPassport() {
  if (
    !GOOGLE_CLIENT_ID ||
    !GOOGLE_CLIENT_SECRET ||
    !GITHUB_CLIENT_ID ||
    !GITHUB_CLIENT_SECRET ||
    !FACEBOOK_APP_ID ||
    !FACEBOOK_APP_SECRET
  ) {
    throw new Error(
      'Missing environment variables for authentication providers',
    );
  }

  passport.use(
    new GoogleStrategy(
      {
        clientID: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        callbackURL: '/auth/google/callback',
      },
      async function (
        accessToken: string,
        refreshToken: string,
        profile: any,
        done: (error: any, user?: any) => void,
      ) {
        const user = await db.user.upsert({
          create: {
            email: profile.emails[0].value,
            name: profile.displayName,
            provider: 'GOOGLE',
          },
          update: {
            name: profile.displayName,
          },
          where: {
            email: profile.emails[0].value,
          },
        });

        done(null, user);
      },
    ),
  );

  passport.use(
    new GithubStrategy(
      {
        clientID: GITHUB_CLIENT_ID,
        clientSecret: GITHUB_CLIENT_SECRET,
        callbackURL: '/auth/github/callback',
      },
      async function (
        accessToken: string,
        refreshToken: string,
        profile: any,
        done: (error: any, user?: any) => void,
      ) {
        const user = await db.user.upsert({
          create: {
            email: profile.emails[0].value,
            name: profile.displayName,
            provider: 'GITHUB',
          },
          update: {
            name: profile.displayName,
          },
          where: {
            email: profile.emails[0].value,
          },
        });

        done(null, user);
      },
    ),
  );

  passport.serializeUser(function (user: any, cb) {
    process.nextTick(function () {
      return cb(null, {
        id: user.id,
        username: user.username,
        picture: user.picture,
      });
    });
  });

  passport.deserializeUser(function (user: any, cb) {
    process.nextTick(function () {
      return cb(null, user);
    });
  });
}

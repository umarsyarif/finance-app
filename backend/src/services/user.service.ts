import crypto from "crypto";
import { Prisma, User } from "@prisma/client";
import config from "config";
import { omit } from "lodash";
import redisClient from "../utils/connectRedis";
import { signJwt } from "../utils/jwt";
import prisma from '../middleware/prismaMiddleware';

export const excludedFields = [
  "password",
  "verified",
  "verificationCode",
  "passwordResetAt",
  "passwordResetToken",
  "apiTokenHash",
];

export const createUser = async (input: Prisma.UserCreateInput) => {
  return (await prisma.user.create({
    data: input,
  })) as User;
};

export const findUser = async (
  where: Prisma.UserWhereInput,
  select?: Prisma.UserSelect
) => {
  return (await prisma.user.findFirst({
    where,
    select,
  })) as User;
};

export const findUniqueUser = async (
  where: Prisma.UserWhereUniqueInput,
  select?: Prisma.UserSelect
) => {
  return (await prisma.user.findUnique({
    where,
    select,
  })) as User;
};

export const updateUser = async (
  where: Prisma.UserWhereUniqueInput,
  data: Prisma.UserUpdateInput,
  select?: Prisma.UserSelect
) => {
  return (await prisma.user.update({ where, data, select })) as User;
};

// One Redis key per login (device), so logging out one device leaves the others signed in
export const sessionKey = (userId: string, sid: string) => `session:${userId}:${sid}`;

export const deleteAllSessions = async (userId: string, keepSid?: string) => {
  const keep = keepSid && sessionKey(userId, keepSid);
  for await (const key of redisClient.scanIterator({ MATCH: sessionKey(userId, "*") })) {
    if (key !== keep) await redisClient.del(key);
  }
};

export const signTokens = async (user: Prisma.UserCreateInput, rememberMe = true) => {
  // 1. Create Session
  const sid = crypto.randomUUID();
  await redisClient.set(sessionKey(user.id!, sid), JSON.stringify(omit(user, excludedFields)), {
    EX: config.get<number>("redisCacheExpiresIn") * 60,
  });

  // 2. Create Access and Refresh tokens
  const access_token = signJwt({ sub: user.id, sid }, "accessTokenPrivateKey", {
    expiresIn: `${config.get<number>("accessTokenExpiresIn")}m`,
  });

  // rm tells the refresh endpoint whether re-issued cookies may outlive the browser session
  const refresh_token = signJwt({ sub: user.id, sid, rm: rememberMe }, "refreshTokenPrivateKey", {
    expiresIn: `${config.get<number>("refreshTokenExpiresIn")}m`,
  });

  return { access_token, refresh_token };
};

// Personal API tokens (iOS Shortcut). Only a SHA-256 hash is stored.
const API_TOKEN_PREFIX = "ft_";
const API_TOKEN_PATTERN = /^ft_[A-Za-z0-9_-]{43}$/;
const hashApiToken = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

export const issueApiToken = async (userId: string) => {
  const token = API_TOKEN_PREFIX + crypto.randomBytes(32).toString("base64url");
  await prisma.user.update({
    where: { id: userId },
    data: { apiTokenHash: hashApiToken(token), apiTokenCreatedAt: new Date(), apiTokenLastUsedAt: null },
  });
  return token;
};

export const revokeApiToken = async (userId: string) => {
  await prisma.user.update({
    where: { id: userId },
    data: { apiTokenHash: null, apiTokenCreatedAt: null, apiTokenLastUsedAt: null },
  });
};

export const getApiTokenStatus = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { apiTokenHash: true, apiTokenCreatedAt: true, apiTokenLastUsedAt: true },
  });
  return {
    exists: !!user?.apiTokenHash,
    createdAt: user?.apiTokenCreatedAt ?? null,
    lastUsedAt: user?.apiTokenLastUsedAt ?? null,
  };
};

// Returns the user (without secrets) for a valid token and records the use; null otherwise
export const findUserByApiToken = async (token: string) => {
  if (!API_TOKEN_PATTERN.test(token)) return null;
  try {
    const user = await prisma.user.update({
      where: { apiTokenHash: hashApiToken(token) },
      data: { apiTokenLastUsedAt: new Date() },
    });
    return omit(user, excludedFields);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") return null;
    throw err;
  }
};

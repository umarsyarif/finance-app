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

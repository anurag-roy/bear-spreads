import { KiteConnect } from "kiteconnect-ts";
import { env } from "@server/lib/env";
import { accessToken } from "@server/lib/services/accessToken";

export const kiteService = new KiteConnect({
  api_key: env.KITE_API_KEY,
  access_token: accessToken,
});
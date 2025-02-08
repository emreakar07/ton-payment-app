import {AssetsSDK} from "@ton-community/assets-sdk";
import {beginCell, storeStateInit, toNano} from "@ton/core";
import {Address} from "@ton/ton";
import {CHAIN} from "@tonconnect/sdk";
import {HttpResponseResolver} from "msw";
import {CreateJettonRequest} from "../dto/create-jetton-request-dto";
import {badRequest, ok, unauthorized} from "../utils/http-utils";
import {decodeAuthToken, verifyToken} from "../utils/jwt";

const VALID_UNTIL = 1000 * 60 * 5; // 5 minutes

/**
 * Checks the proof and returns an access token.
 *
 * POST /api/create_jetton
 */
export const createJetton: HttpResponseResolver = async ({request}) => {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');

    if (!token || !await verifyToken(token)) {
      return unauthorized({error: 'Unauthorized'});
    }

    const payload = decodeAuthToken(token);
    if (!payload?.address || !payload?.network) {
      return unauthorized({error: 'Invalid token'});
    }

    const body = CreateJettonRequest.parse(await request.json());

    // specify the time until the message is valid
    const validUntil = Math.round((Date.now() + VALID_UNTIL) / 1000);

    // amount of TON to send with the message
    const amount = toNano('0.06').toString();

    // who will be the owner of the jetton
    const ownerAddress = Address.parse(payload.address);

    // Create SDK instance
    const sdk = AssetsSDK.create({
      api: payload.network === CHAIN.TESTNET ? 'testnet' : 'mainnet'
    });

    // Deploy jetton using SDK
    const deployData = await sdk.deployJetton({
      name: body.name,
      description: body.description,
      symbol: body.symbol,
      image_data: body.image_data,
      amount: body.amount,
      decimals: body.decimals
    }, {
      ownerAddress: ownerAddress,
      amount: amount,
      validUntil: validUntil
    });

    return ok(deployData);

  } catch (e) {
    if (e instanceof Error) {
      return badRequest({error: 'Invalid request', trace: e.message});
    }
    return badRequest({error: 'Invalid request', trace: e});
  }
}

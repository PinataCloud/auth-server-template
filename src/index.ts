import { Hono } from "hono";
import { PinataFDK } from "pinata-fdk";
import {
  createAppClient,
  viemConnector,
  AppClient,
} from "@farcaster/auth-client";

type Variables = {
  fdk: PinataFDK;
  appClient: AppClient;
};

const app = new Hono<{
  Variables: Variables;
  Bindings: {
    PINATA_JWT: string;
    FARCASTER_DEVELOPER_MNEMONIC: string;
    FARCASTER_DEVELOPER_FID: string;
    FDK: PinataFDK;
  };
}>();

app.use(async (c, next) => {
  const fdk = new PinataFDK({
    pinata_jwt: c.env.PINATA_JWT,
    pinata_gateway: "",
    app_fid: c.env.FARCASTER_DEVELOPER_FID,
    app_mnemonic: c.env.FARCASTER_DEVELOPER_MNEMONIC,
  });

  const appClient = createAppClient({
    relay: "https://relay.farcaster.xyz",
    ethereum: viemConnector(),
  });

  c.set("fdk", fdk);
  c.set("appClient", appClient);
  await next();
});

app.get("/", (c) => {
  return c.text("Hello Cloudflare Workers!");
});

app.post("/signer", async (c) => {
  const fdk = c.get("fdk");
  try {
    const res = await fdk.createSponsoredSigner();
    return c.json(res);
  } catch (error) {
    console.log(error);
    return c.json(error);
  }
});

app.get("/pollSigner", async (c) => {
  const fdk = c.get("fdk");
  const token: any = c.req.query("token");
  try {
    const res = await fdk.pollSigner(token);
    console.log(res);
    return c.json(res);
  } catch (error) {
    console.log(error);
    return c.json(error);
  }
});

app.post("/retrieveSigner", async (c) => {
  const body = await c.req.json();
  const appClient = c.get("appClient");
  const fdk = c.get("fdk");
  try {
    const { success, fid, error, isError } =
      await appClient.verifySignInMessage({
        nonce: "nonce",
        domain: "example.xyz",
        message: body.message,
        signature: body.signature,
      });

    if (isError) {
      console.log(error);
      return c.json(error);
    }

    if (success) {
      const res = await fdk.getSigners(fid);
      console.log(res);
      return c.json(res);
    } else {
      return c.json("Error verifying signature");
    }
  } catch (error) {
    console.log(error);
    return c.json(error);
  }
});

app.post("/cast", async (c) => {
  const body= await c.req.json();
  const fdk = c.get("fdk");
  const message = body.castMessage;

  try {
    const res = await fdk.sendCast({
      castAddBody: {
        text: message,
      },
      signerId: body.signerId,
    });
    if (!res.hash) {
      return c.json({ Error: "Failed to send cast" }, { status: 500 });
    } else {
      const hash = res.hash;
      return c.json({ hash }, { status: 200 });
    }
  } catch (error) {
    console.log(error);
    return c.json(error);
  }
});

export default app;

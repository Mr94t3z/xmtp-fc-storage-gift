import { Button, Frog, TextInput } from 'frog'
import { handle } from 'frog/vercel'
import { validateFramesPost } from "@xmtp/frames-validator";
import type { MiddlewareHandler } from 'hono'

// Uncomment this packages to tested on local server
// import { devtools } from 'frog/dev';
// import { serveStatic } from 'frog/serve-static';
 
const addMetaTags = (client: string, version?: string) => {
  // Follow the OpenFrames meta tags spec
  return {
    unstable_metaTags: [
      { property: `of:accepts`, content: version || "vNext" },
      { property: `of:accepts:${client}`, content: version || "vNext" },
    ],
  };
};
 
function xmtpSupport(): MiddlewareHandler<{
  Variables: { client?: 'xmtp' | 'farcaster'; verifiedWalletAddress?: string }
}> {
  return async (c, next) => {
    // Check if the request is a POST and relevant for XMTP processing
    if (c.req.method === "POST") {
      const requestBody = (await c.req.json().catch(() => {})) || {};
      if (requestBody?.clientProtocol?.includes("xmtp")) {
        c.set("client", "xmtp");
        const { verifiedWalletAddress } = await validateFramesPost(requestBody);
        c.set("verifiedWalletAddress", verifiedWalletAddress);
      } else {
        // Add farcaster check
        c.set("client", "farcaster");
      }
    }
    await next();
  }
}

export const app = new Frog({
  ...addMetaTags('xmtp'),
  assetsPath: '/',
  basePath: '/api/frame',
  // Uncomment and provide the API key if you need to enable frame verification
  // hub: neynar({ apiKey: 'NEYNAR_FROG_FM' })
})
  .use(xmtpSupport());
 
// Access verified wallet address in a frame:
app.frame("/", (c) => {
  /* Get Frame variables */
  // const { buttonValue, inputText, status } = c;
 
  // XMTP verified address
  const { verifiedWalletAddress } = c?.var || {};
 
  return c.res({
    image: (
      <div tw="flex">
        XMTP Frame. Verified Address: {verifiedWalletAddress}
      </div>
    )
  })
})


// Uncomment for local server testing
// devtools(app, { serveStatic });

export const GET = handle(app)
export const POST = handle(app)
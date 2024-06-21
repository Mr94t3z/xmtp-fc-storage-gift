import { Button, Frog, TextInput } from 'frog'
import { handle } from 'frog/vercel'
import { validateFramesPost } from "@xmtp/frames-validator";
import { Box, Image, Heading, Text, VStack, Spacer, vars } from "../lib/ui.js";
import { storageRegistry } from "../lib/contracts.js";
import { createGlideClient, Chains, CurrenciesByChain } from "@paywithglide/glide-js";
import { encodeFunctionData, hexToBigInt, toHex } from 'viem';
import type { MiddlewareHandler } from 'hono'
import dotenv from 'dotenv';

// Uncomment this packages to tested on local server
// import { devtools } from 'frog/dev';
// import { serveStatic } from 'frog/serve-static';

// Load environment variables from .env file
dotenv.config();

// Create Glide client
export const glideClient = createGlideClient({
  projectId: process.env.GLIDE_PROJECT_ID,
 
  // Lists the chains where payments will be accepted
  chains: [Chains.Base, Chains.Optimism],
});

// Neynar API base URL
const baseUrlNeynarV2 = process.env.BASE_URL_NEYNAR_V2;
 
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
  ui: { vars },
})
  .use(xmtpSupport());
 
// Access verified wallet address in a frame:
// app.frame("/", (c) => {
//   /* Get Frame variables */
//   // const { buttonValue, inputText, status } = c;
 
//   // XMTP verified address
//   const { verifiedWalletAddress } = c?.var || {};
 
//   return c.res({
//     image: (
//       <div tw="flex">
//         XMTP Frame. Verified Address: {verifiedWalletAddress}
//       </div>
//     )
//   })
// })


// Initial frame
app.frame('/', (c) => {
  return c.res({
    title: 'XMTP - FC Storage Gift',
    image: (
      <Box
          grow
          alignVertical="center"
          backgroundColor="bg"
          padding="48"
          textAlign="center"
          height="48"
        >
          <VStack gap="4">
              <Box flexDirection="row">
                <Image
                    height="24"
                    objectFit="cover"
                    src="https://xmtp.org/img/logomark-dark.svg"
                  />
              </Box>
              <Spacer size="16" />
              <Heading color="white" weight="900" align="center" size="32">
                FC Storage Gift 
              </Heading>
              <Spacer size="22" />
              <Text align="center" color="grey" size="14">
                An Open Frame to gift storage to the Farcaster users.
              </Text>
              <Text align="center" color="grey" size="14">
                Powered by XMTP.
              </Text>
              <Spacer size="32" />
              <Box flexDirection="row" justifyContent="center">
                  <Text color="white" align="center" size="14">created by</Text>
                  <Spacer size="4" />
                  <Text color="grey" decoration="underline" align="center" size="14"> @0x94t3z</Text>
              </Box>
          </VStack>
      </Box>
    ),
    intents: [
      <TextInput placeholder="Search by farcaster username" />,
      <Button action='/gift'>Submit</Button>,
    ]
  })
})


app.frame('/gift', async (c) => {
  const { inputText } = c;

  const username = inputText;

  try {

    const response = await fetch(`${baseUrlNeynarV2}/user/search?q=${username}`, {
      method: 'GET',
      headers: {
          'accept': 'application/json',
          'api_key': process.env.NEYNAR_API_KEY || '',
      },
    });

    if (!response.ok) {
      return c.error(
        {
          message : 'User not found!',
        }
      )
    }

    const data = await response.json();
    if (!data.result || !data.result.users || data.result.users.length === 0) {
      return c.error(
        {
          message : 'User not found!',
        }
      )
    }

    const user = data.result.users[0];

    const toFid = user.fid;

    return c.res({
      title: 'XMTP - FC Storage Gift',
      action: `/tx-status`,
      image: `/gift-image/${toFid}`,
      intents: [
        <Button.Transaction target={`/tx-gift`}>Confirm</Button.Transaction>,
        <Button action='/'>Cancel</Button>,
      ]
    })
    } catch (error) {
      return c.res({
        image: (
          <Box
              grow
              alignVertical="center"
              backgroundColor="bg"
              padding="48"
              textAlign="center"
              height="100%"
          >
              <VStack gap="4">
                  <Box flexDirection="row">
                    <Image
                        height="24"
                        objectFit="cover"
                        src="https://xmtp.org/img/logomark-dark.svg"
                      />
                  </Box>
                  <Spacer size="16" />
                  <Heading color="white" weight="900" align="center" size="32">
                    ⚠️ Failed ⚠️
                  </Heading>
                  <Spacer size="22" />
                  <Text align="center" color="grey" size="16">
                     Uh oh, something went wrong!
                  </Text>
                  <Spacer size="32" />
                  <Box flexDirection="row" justifyContent="center">
                    <Text color="white" align="center" size="14">created by</Text>
                    <Spacer size="4" />
                    <Text color="grey" decoration="underline" align="center" size="14"> @0x94t3z</Text>
                </Box>
              </VStack>
          </Box>
        ),
        intents: [
          <Button.Reset>Try again</Button.Reset>,
        ]
    });
    }
})


app.image('/gift-image/:toFid', async (c) => {
  const { toFid } = c.req.param();

  const response = await fetch(`${baseUrlNeynarV2}/user/bulk?fids=${toFid}`, {
    method: 'GET',
    headers: {
      'accept': 'application/json',
      'api_key': process.env.NEYNAR_API_KEY || '',
    },
  });

  const data = await response.json();
  const user = data.users[0];

  return c.res({
    imageOptions: {
      headers: {
        'Cache-Control': 'max-age=0',
      },
    },
    image: (
      <Box
        grow
        alignVertical="center"
        backgroundColor="bg"
        padding="48"
        textAlign="center"
        height="100%"
      >
        <VStack gap="4">
            <Box flexDirection="row">
              <Image
                  height="24"
                  objectFit="cover"
                  src="https://xmtp.org/img/logomark-dark.svg"
                />
            </Box>
            <Spacer size="22" />
            <Box flexDirection="row" alignHorizontal="center" alignVertical="center">

              <img
                  height="128"
                  width="128"
                  src={user.pfp_url}
                  style={{
                    borderRadius: "38%",
                    border: "3.5px solid #FC4E37",
                  }}
                />
              
              <Spacer size="12" />
                <Box flexDirection="column" alignHorizontal="left">
                  <Text color="white" align="left" size="14">
                    {user.display_name}
                  </Text>
                  <Text color="grey" align="left" size="12">
                    @{user.username}
                  </Text>
                </Box>
              </Box>
            <Spacer size="22" />
            <Box flexDirection="row" justifyContent="center">
              <Text color="white" align="center" size="16">Do you want to gift</Text>
              <Spacer size="4" />
              <Text color="orange" align="center" size="16">@{user.username}</Text>
              <Spacer size="4" />
              <Text color="white" align="center" size="16">?</Text>
            </Box>
            <Spacer size="32" />
            <Box flexDirection="row" justifyContent="center">
                <Text color="white" align="center" size="14">created by</Text>
                <Spacer size="4" />
                <Text color="grey" decoration="underline" align="center" size="14"> @0x94t3z</Text>
            </Box>
        </VStack>
    </Box>
    ),
  })
})

 
app.transaction('/tx-gift/:toFid', async (c, next) => {
  await next();
  const txParams = await c.res.json();
  txParams.attribution = false;
  console.log(txParams);
  c.res = new Response(JSON.stringify(txParams), {
    headers: {
      "Content-Type": "application/json",
    },
  });
},
async (c) => {
  const { address } = c;
  const { toFid } = c.req.param();

  // Get current storage price
  const units = 1n;
  const price = await storageRegistry.read.price([units]);

  const { unsignedTransaction } = await glideClient.createSession({
    payerWalletAddress: address,
   
    // Optional. Setting this restricts the user to only
    // pay with the specified currency.
    paymentCurrency: CurrenciesByChain.BaseMainnet.ETH,
    
    transaction: {
      chainId: Chains.Optimism.caip2,
      to: storageRegistry.address,
      value: toHex(price),
      input: encodeFunctionData({
        abi: storageRegistry.abi,
        functionName: "rent",
        args: [BigInt(toFid), units],
      }),
    },
  });

  if (!unsignedTransaction) {
    throw new Error("missing unsigned transaction");
  }

  return c.send({
    chainId: Chains.Base.caip2,
    to: unsignedTransaction.to,
    data: unsignedTransaction.input,
    value: hexToBigInt(unsignedTransaction.value),
  });
})


app.frame("/tx-status", async (c) => {
  const { transactionId, buttonValue } = c;
 
  // The payment transaction hash is passed with transactionId if the user just completed the payment. If the user hit the "Refresh" button, the transaction hash is passed with buttonValue.
  const txHash = transactionId || buttonValue;
 
  if (!txHash) {
    throw new Error("missing transaction hash");
  }
 
  try {
    let session = await glideClient.getSessionByPaymentTransaction({
      chainId: Chains.Base.caip2,
      txHash,
    });
 
    // Wait for the session to complete. It can take a few seconds
    session = await glideClient.waitForSession(session.sessionId);
 
    return c.res({
      image: (
        <Box
          grow
          alignVertical="center"
          backgroundColor="black"
          padding="48"
          textAlign="center"
          height="100%"
        >
          <VStack gap="4">
              <Box flexDirection="row">
                <Image
                    height="24"
                    objectFit="cover"
                    src="/images/arb.png"
                  />
              </Box>
              <Spacer size="16" />
              <Heading color="white" weight="900" align="center" size="32">
                Tx Status
              </Heading>
              <Spacer size="22" />
              <Text align="center" color="grey" size="16">
                Storage gifted successfully!
              </Text>
              <Spacer size="22" />
              <Box flexDirection="row" justifyContent="center">
                  <Text color="white" align="center" size="14">created by</Text>
                  <Spacer size="10" />
                  <Text color="grey" decoration="underline" align="center" size="14"> @0x94t3z</Text>
              </Box>
          </VStack>
      </Box>
      ),
      intents: [
        <Button.Link
          href={`https://optimistic.etherscan.io/tx/${session.sponsoredTransactionHash}`}
        >
          View on Exploler
        </Button.Link>,
        <Button.Reset>Home</Button.Reset>,
      ],
    });
  } catch (e) {
    // If the session is not found, it means the payment is still pending.
    // Let the user know that the payment is pending and show a button to refresh the status.
    return c.res({
      image: '/waiting.gif',
      intents: [
        <Button value={txHash} action="/tx-status">
          Refresh
        </Button>,
      ],
    });
  }
});



// Uncomment for local server testing
// devtools(app, { serveStatic });

export const GET = handle(app)
export const POST = handle(app)
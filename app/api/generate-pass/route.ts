import { PKPass } from 'passkit-generator';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const data = Object.fromEntries(searchParams.entries());
  return handleGeneratePass(data);
}

export async function POST(req: Request) {
  try {
    const data = await req.json();
    return handleGeneratePass(data);
  } catch (error: any) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
}

async function handleGeneratePass(data: any) {
  try {
    // Check for required Apple Developer certificates
    if (!process.env.APPLE_WWDR_CERT || !process.env.APPLE_SIGNER_CERT || !process.env.APPLE_SIGNER_KEY) {
      return NextResponse.json(
        { 
          error: "Missing Apple Developer Certificates. Please configure APPLE_WWDR_CERT, APPLE_SIGNER_CERT, and APPLE_SIGNER_KEY in your environment variables to generate valid passes." 
        }, 
        { status: 400 }
      );
    }

    const passJson = {
      "formatVersion": 1,
      "passTypeIdentifier": process.env.APPLE_PASS_TYPE_ID || "pass.com.example.app",
      "serialNumber": `pass-${Date.now()}`,
      "teamIdentifier": process.env.APPLE_TEAM_ID || "TEAMID1234",
      "organizationName": data.logoText || "The Society",
      "description": data.description || "Exclusive Member Pass",
      "logoText": data.logoText || "The Society",
      "foregroundColor": data.foregroundColor || "rgb(255, 255, 255)",
      "backgroundColor": data.backgroundColor || "rgb(0, 0, 0)",
      "labelColor": data.labelColor || "rgb(161, 161, 170)",
      "generic": {
        "primaryFields": [
          {
            "key": "primary",
            "label": data.primaryLabel || "Member Status",
            "value": data.primaryValue || "Founding Member"
          }
        ],
        "secondaryFields": [
          {
            "key": "memberId",
            "label": "Member ID",
            "value": data.barcodeValue || "000000"
          }
        ]
      },
      "barcodes": [
        {
          "format": data.barcodeFormat || "PKBarcodeFormatQR",
          "message": data.barcodeValue || "https://example.com",
          "messageEncoding": "iso-8859-1",
          "altText": data.barcodeValue || ""
        }
      ],
      "locations": [
        {
          "latitude": 41.8240,
          "longitude": -71.4128,
          "relevantText": "Welcome to The Society"
        }
      ]
    };

    const passOptions: any = {
      wwdr: process.env.APPLE_WWDR_CERT,
      signerCert: process.env.APPLE_SIGNER_CERT,
      signerKey: process.env.APPLE_SIGNER_KEY,
    };

    if (process.env.APPLE_SIGNER_KEY_PASSPHRASE) {
      passOptions.signerKeyPassphrase = process.env.APPLE_SIGNER_KEY_PASSPHRASE;
    }

    const placeholderPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

    const passFiles: any = {
      "pass.json": Buffer.from(JSON.stringify(passJson)),
      "icon.png": placeholderPng,
      "icon@2x.png": placeholderPng,
      "logo.png": placeholderPng,
      "logo@2x.png": placeholderPng
    };

    if (data.backgroundImage) {
      const bgBuffer = Buffer.from(data.backgroundImage, 'base64');
      passFiles["background.png"] = bgBuffer;
      passFiles["background@2x.png"] = bgBuffer;
    }

    const pass = new PKPass(passFiles, passOptions);

    const buffer = await pass.getAsBuffer();

    return new Response(buffer as any, {
      headers: {
        'Content-Type': 'application/vnd.apple.pkpass',
        'Content-Disposition': 'inline; filename="pass.pkpass"',
        'Content-Length': buffer.length.toString(),
        'Content-Transfer-Encoding': 'binary',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'X-Content-Type-Options': 'nosniff'
      }
    });
  } catch (error: any) {
    console.error("Error generating pass:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate pass" }, 
      { status: 500 }
    );
  }
}

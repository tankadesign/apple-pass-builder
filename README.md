# Apple Wallet Pass Generator

A web application for designing and generating custom Apple Wallet passes (`.pkpass` files). This tool allows you to customize the appearance, barcode, and location-awareness of your passes, and instantly download them for use on iOS devices.

## Setup and Configuration

To generate valid Apple Wallet passes, you must configure the application with your Apple Developer certificates. Passes must be cryptographically signed by an Apple Developer account to be accepted by iOS devices.

### Prerequisites
- An active [Apple Developer Program](https://developer.apple.com/programs/) membership.
- A Mac computer (for Keychain Access) or OpenSSL installed on your system.

### Step 1: Create a Pass Type Identifier
1. Log in to your [Apple Developer Account](https://developer.apple.com/account).
2. Navigate to **Certificates, Identifiers & Profiles** > **Identifiers**.
3. Click the **+** button to create a new identifier.
4. Select **Pass Type IDs** and click **Continue**.
5. Enter a Description and an Identifier (e.g., `pass.com.yourdomain.app`).
6. Click **Continue** and then **Register**.

### Step 2: Obtain the WWDR Certificate
1. Go to the [Apple PKI page](https://www.apple.com/certificateauthority/).
2. Download the **Apple Worldwide Developer Relations Certification Authority (G4)** certificate.
3. Export this certificate as a `.pem` file. If you download a `.cer` file, you can convert it using OpenSSL:
   ```bash
   openssl x509 -inform der -in AppleWWDRCAG4.cer -out wwdr.pem
   ```

### Step 3: Create a Pass Signing Certificate
1. In your Apple Developer Account, go to **Certificates, Identifiers & Profiles** > **Certificates**.
2. Click the **+** button.
3. Under Services, select **Pass Type ID Certificate** and click **Continue**.
4. Provide a Certificate Signing Request (CSR) from your Mac (using Keychain Access) or OpenSSL.
5. Download the generated `.cer` certificate.

### Step 4: Export the Certificate and Private Key
1. Double-click the downloaded `.cer` file to install it into your Mac's **Keychain Access**.
2. Open Keychain Access and find the certificate (it will start with "Pass Type ID:").
3. Expand the certificate to reveal the associated private key.
4. Select *both* the certificate and the private key, right-click, and choose **Export 2 items...**.
5. Export them as a `.p12` file (e.g., `Certificates.p12`) and set a password.

### Step 5: Convert to PEM Format
You need to extract the certificate and the private key into separate `.pem` files. Open your terminal and run the following OpenSSL commands:

**Extract the Certificate:**
```bash
openssl pkcs12 -in Certificates.p12 -clcerts -nokeys -out signerCert.pem
```

**Extract the Private Key:**
```bash
openssl pkcs12 -in Certificates.p12 -nocerts -out signerKey.pem
```
*(You will be prompted to enter the password you set in Step 4, and then create a new PEM pass phrase for the key).*

### Step 6: Configure Environment Variables
Copy the contents of your `.pem` files and set them as environment variables in your deployment or `.env` file.

```env
# The contents of your wwdr.pem file
APPLE_WWDR_CERT="-----BEGIN CERTIFICATE-----\n..."

# The contents of your signerCert.pem file
APPLE_SIGNER_CERT="-----BEGIN CERTIFICATE-----\n..."

# The contents of your signerKey.pem file
APPLE_SIGNER_KEY="-----BEGIN ENCRYPTED PRIVATE KEY-----\n..."

# The passphrase you set for the private key in Step 5 (if any)
APPLE_SIGNER_KEY_PASSPHRASE="your_passphrase_here"

# The Pass Type ID you created in Step 1
APPLE_PASS_TYPE_ID="pass.com.yourdomain.app"

# Your Apple Developer Team ID (found in your Apple Developer account settings)
APPLE_TEAM_ID="YOUR_TEAM_ID"
```

Once these environment variables are configured, the application will be able to successfully sign and generate `.pkpass` files!

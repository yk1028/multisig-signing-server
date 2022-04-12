import { LCDClient, SignatureV2, SignDoc, MsgSend, SimplePublicKey, LegacyAminoMultisigPublicKey, Key} from '@terra-money/terra.js';
import { KeyManagementServiceClient } from "@google-cloud/kms";
import { GcpHsmKey } from './hsm/GcpHsmKey';
import { GcpHsmSigner } from './hsm/GcpHsmSigner';

import express from "express";
import * as keyInfo from '../.key-info.json';

const terra = new LCDClient({
    URL: 'https://bombay-lcd.terra.dev',
    chainID: 'bombay-12',
    gasPrices: { uluna: 0.01133 },
});

const getMultiSigAddresss = () => {
    const multisigPubkey = new LegacyAminoMultisigPublicKey(2, [
        new SimplePublicKey(keyInfo.stationServerPublickey),
        new SimplePublicKey(keyInfo.signingServerPublickey),
    ]);

    return multisigPubkey.address();
}

const sign = async (receiverAddress: string, amount: string, memo: string): Promise<SignatureV2> => {

    const multiSigAddress = getMultiSigAddresss();

    const msg = new MsgSend(
        multiSigAddress,
        receiverAddress,
        amount
      );

    const accInfo = await terra.auth.accountInfo(multiSigAddress);
    const tx = await terra.tx.create(
        [
            {
                address: multiSigAddress,
                sequenceNumber: accInfo.getSequenceNumber(),
                publicKey: accInfo.getPublicKey(),
            },
        ],
        {
            msgs: [msg],
            memo: memo
        }
    );
    // GCP HSM
	const kms = new KeyManagementServiceClient();
	const versionName = kms.cryptoKeyVersionPath(
		keyInfo.gcpInfo.projectId,
		keyInfo.gcpInfo.locationId,
		keyInfo.gcpInfo.keyRingId,
		keyInfo.gcpInfo.keyId,
		keyInfo.gcpInfo.versionId
	);
	const gcpHsmUtils = new GcpHsmSigner(kms, versionName);
	const pubkey = await gcpHsmUtils.getPublicKey();
	const gcpHsmKey: Key = new GcpHsmKey(gcpHsmUtils, pubkey);
    
    console.log(gcpHsmKey.publicKey as SimplePublicKey);

    return await gcpHsmKey.createSignatureAmino(
        new SignDoc(
            terra.config.chainID,
            accInfo.getAccountNumber(),
            accInfo.getSequenceNumber(),
            tx.auth_info,
            tx.body
        )
    );
}

const app = express();
const port = 8000; // default port to listen

app.use(express.json());

app.post( "/sign", async ( req, res ) => {

    const json = JSON.parse(req.body.jsonTx);

    console.log(json);

    const signature = await sign(json.receiverAddress, json.amount, json.memo);

    console.log(signature);

    res.send(JSON.stringify(signature));
} );

// start the Express server
app.listen( port, () => {
    console.log( `server started at http://localhost:${ port }` );
} );
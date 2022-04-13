import { LCDClient, SignatureV2, SignDoc, MsgSend, SimplePublicKey, LegacyAminoMultisigPublicKey, Key, Tx, Coins } from '@terra-money/terra.js';
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

const multisigPubkey = new LegacyAminoMultisigPublicKey(2, [
    new SimplePublicKey(keyInfo.stationServerPublickey),
    new SimplePublicKey(keyInfo.signingServerPublickey),
]);

const getGcpHsmKey = async (): Promise<GcpHsmKey> => {
    const kms = new KeyManagementServiceClient();
    const versionName = kms.cryptoKeyVersionPath(
        keyInfo.gcpInfo.projectId,
        keyInfo.gcpInfo.locationId,
        keyInfo.gcpInfo.keyRingId,
        keyInfo.gcpInfo.keyId,
        keyInfo.gcpInfo.versionId
    );
    const gcpHsmSigner = new GcpHsmSigner(kms, versionName);
    const pubkey = await gcpHsmSigner.getPublicKey();
    return new GcpHsmKey(gcpHsmSigner, pubkey);
}

const createTx = async (receiverAddress: string, amount: Coins.Input, memo: string): Promise<Tx> => {

    const address = multisigPubkey.address();
    const accInfo = await terra.auth.accountInfo(address);

    const msg = new MsgSend(
        address,
        receiverAddress,
        amount
    );

    return await terra.tx.create(
        [
            {
                address,
                sequenceNumber: accInfo.getSequenceNumber(),
                publicKey: accInfo.getPublicKey(),
            },
        ],
        {
            msgs: [msg],
            memo: memo
        }
    );
}

const sign = async (tx: Tx): Promise<SignatureV2> => {

    const multiSigAddress = multisigPubkey.address();
    const accInfo = await terra.auth.accountInfo(multiSigAddress);
    const gcpHsmKey = await getGcpHsmKey();

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

app.post("/sign", async (req, res) => {

    const json = JSON.parse(req.body.json);

    console.log("=========Request=========");
    console.log(json);

    const tx = await createTx(json.receiverAddress, json.amount, json.memo);
    const signature = await sign(tx);

    console.log("=========Response=========");
    console.log(signature);

    res.send(JSON.stringify(signature));
});

// start the Express server
app.listen(port, () => {
    console.log(`server started`);
});
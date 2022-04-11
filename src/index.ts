import express from "express";
import { LCDClient, MnemonicKey, SignatureV2, SignDoc, MsgSend, SimplePublicKey, LegacyAminoMultisigPublicKey, MultiSignature } from '@terra-money/terra.js';
import * as keyInfo from '../.key-info.json';

const terra = new LCDClient({
    URL: 'https://bombay-lcd.terra.dev',
    chainID: 'bombay-12',
    gasPrices: { uluna: 0.01133 },
});

const sign = async (receiverAddress: string, amount: string, memo: string): Promise<SignatureV2> => {

    const multisigPubkey = new LegacyAminoMultisigPublicKey(2, [
        new SimplePublicKey(keyInfo.stationServerPublickey),
        new SimplePublicKey(keyInfo.signingServerPublickey),
    ]);

    const address = multisigPubkey.address();

    const msg = new MsgSend(
        address,
        receiverAddress,
        amount
      );

    const accInfo = await terra.auth.accountInfo(address);
    const tx = await terra.tx.create(
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

    const mnemonicKey = new MnemonicKey({
        mnemonic: keyInfo.mnemonic
    })

    return await mnemonicKey.createSignatureAmino(
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
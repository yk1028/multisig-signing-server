import express from "express";
import { Account, Key, LCDClient, MnemonicKey, SignatureV2, SignDoc, Tx, MsgSend, Fee, TxBody, SimplePublicKey, LegacyAminoMultisigPublicKey, MultiSignature } from '@terra-money/terra.js';
import * as keyInfo from '../.key-info.json';

const terra = new LCDClient({
    URL: 'https://bombay-lcd.terra.dev',
    chainID: 'bombay-12',
    gasPrices: { uluna: 0.01133 },
});

const sign = async (senderAddress: SimplePublicKey, msg: MsgSend, memo: string): Promise<SignatureV2> => {

    const mnemonicKey = new MnemonicKey({
        mnemonic: keyInfo.mnemonic
    })

    const multisigPubkey = new LegacyAminoMultisigPublicKey(2, [
        mnemonicKey.publicKey as SimplePublicKey, 
        senderAddress as SimplePublicKey // other project pubkey
    ]);

    const address = multisigPubkey.address();
    const multisig = new MultiSignature(multisigPubkey);

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

    const senderAddress = json.senderAddress;
    const receiverAddress = json.receiverAddress;
    const amount = json.amount;
    const memo = json.memo;

    const sendMsg = new MsgSend(
        senderAddress,
        receiverAddress,
        amount
    );

    console.log(sendMsg);

    const signature = await sign(new SimplePublicKey(senderAddress), sendMsg, memo);

    console.log(signature);

    res.send(JSON.stringify(signature));
} );

// start the Express server
app.listen( port, () => {
    console.log( `server started at http://localhost:${ port }` );
} );
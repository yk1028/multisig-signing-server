
import { SimplePublicKey, LegacyAminoMultisigPublicKey } from '@terra-money/terra.js';

import * as keyInfo from '../.key-info.json';

const multisigPubkey = async () => {
    const multisigPubkey = new LegacyAminoMultisigPublicKey(2, [
        new SimplePublicKey(keyInfo.stationServerPublickey),
        new SimplePublicKey(keyInfo.signingServerPublickey),
    ]);

    console.log(multisigPubkey.address())
}

multisigPubkey();
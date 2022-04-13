import { SimplePublicKey, Key } from '@terra-money/terra.js';
import { KeyManagementServiceClient } from "@google-cloud/kms";
import { GcpHsmKey } from './hsm/GcpHsmKey';
import { GcpHsmSigner } from './hsm/GcpHsmSigner';

import * as keyInfo from '../.key-info.json';

const pubkey = async () => {
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
}

pubkey();
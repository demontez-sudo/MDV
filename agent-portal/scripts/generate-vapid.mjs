/* Makes the signing keys the portal needs to send alerts to a MacBook or iPhone.
   Run it on your own computer:   node scripts/generate-vapid.mjs
   It prints three lines. Add them as environment variables in Netlify (Site settings → Environment variables) for the agent portal site,
   then redeploy. Keep the private key to yourself: it is only ever typed into Netlify, never shared or committed. */
import crypto from 'node:crypto';
const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
const pj = publicKey.export({ format: 'jwk' }), vj = privateKey.export({ format: 'jwk' });
const pub = Buffer.concat([Buffer.from([4]), Buffer.from(pj.x, 'base64url'), Buffer.from(pj.y, 'base64url')]).toString('base64url');
console.log('\nAdd these to Netlify → Environment variables:\n');
console.log('VAPID_PUBLIC_KEY=' + pub);
console.log('VAPID_PRIVATE_KEY=' + vj.d);
console.log('VAPID_SUBJECT=mailto:' + (process.argv[2] || 'agent@maisondeveux.com') + '\n');

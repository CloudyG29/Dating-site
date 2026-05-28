const express = require('express');
const crypto = require('crypto');
const { db } = require('../lib/firebase');
const router = express.Router();

const PF_MERCHANT_ID = process.env.PF_MERCHANT_ID;
const PF_MERCHANT_KEY = process.env.PF_MERCHANT_KEY;
const PF_PASSPHRASE = process.env.PF_PASSPHRASE;
const IS_SANDBOX = process.env.NODE_ENV !== 'production';

// Generate PayFast payment data for the frontend
router.post('/initiate', async (req, res) => {
  const { uid, email, name } = req.body;

  const data = {
    merchant_id: PF_MERCHANT_ID,
    merchant_key: PF_MERCHANT_KEY,
    return_url: `${process.env.APP_URL}/dashboard?payment=success`,
    cancel_url: `${process.env.APP_URL}/payment?cancelled=true`,
    notify_url: `${process.env.SERVER_URL}/payment/notify`,
    name_first: name.split(' ')[0] || 'Member',
    name_last: name.split(' ')[1] || '',
    email_address: email,
    m_payment_id: uid,          // your internal reference = Firebase UID
    amount: '29.00',
    item_name: 'Soulthread Membership',
    custom_str1: uid,            // store UID to look up on webhook
  };

  // Build signature
  const paramString = Object.entries(data)
    .map(([k, v]) => `${k}=${encodeURIComponent(v.trim()).replace(/%20/g, '+')}`)
    .join('&') + `&passphrase=${encodeURIComponent(PF_PASSPHRASE)}`;

  data.signature = crypto.createHash('md5').update(paramString).digest('hex');

  const pfHost = IS_SANDBOX
    ? 'https://sandbox.payfast.co.za/eng/process'
    : 'https://www.payfast.co.za/eng/process';

  res.json({ pfUrl: pfHost, data });
});

// PayFast ITN webhook — called by PayFast after payment
router.post('/notify', express.urlencoded({ extended: false }), async (req, res) => {
  const pfData = req.body;

  // 1. Verify signature
  const received = pfData.signature;
  delete pfData.signature;
  const paramString = Object.entries(pfData)
    .filter(([, v]) => v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(v.trim()).replace(/%20/g, '+')}`)
    .join('&') + `&passphrase=${encodeURIComponent(PF_PASSPHRASE)}`;
  const expected = crypto.createHash('md5').update(paramString).digest('hex');

  if (received !== expected) return res.status(400).send('Invalid signature');

  // 2. Verify payment status and amount
  if (pfData.payment_status !== 'COMPLETE') return res.status(200).send('OK');
  if (parseFloat(pfData.amount_gross) < 29.00) return res.status(400).send('Insufficient amount');

  // 3. Mark user as paid in Firestore
  const uid = pfData.custom_str1;
  await db.collection('users').doc(uid).update({
    paid: true,
    active: true,
    paidAt: new Date().toISOString(),
    pfPaymentId: pfData.pf_payment_id,
  });

  // 4. Trigger matching (Cloud Function or inline)
  await triggerMatching(uid);

  res.status(200).send('OK');
});

module.exports = router;
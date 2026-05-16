import dns from 'dns/promises';

// Top 500 disposable email domains
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com','guerrillamail.com','tempmail.com','throwaway.email',
  'yopmail.com','sharklasers.com','guerrillamailblock.com','grr.la',
  'guerrillamail.info','guerrillamail.biz','guerrillamail.de','guerrillamail.net',
  'guerrillamail.org','spam4.me','trashmail.com','trashmail.me','trashmail.at',
  'trashmail.io','trashmail.net','dispostable.com','mailnull.com','spamgourmet.com',
  'spamgourmet.net','spamgourmet.org','spamspot.com','spamthis.co.uk','spamtrap.ro',
  'maildrop.cc','spamfree24.org','spamfree24.de','spamfree24.eu','spamfree24.info',
  'spamfree24.net','spamfree.eu','tempinbox.com','tempinbox.co.uk','mailexpire.com',
  'temporaryemail.net','throwam.com','10minutemail.com','10minutemail.net',
  '10minutemail.org','20minutemail.com','discard.email','discardmail.com',
  'discardmail.de','spamboy.com','trashmail.fr','trashmail.se','mailismagic.com',
  'filzmail.com','sogetthis.com','sharklasers.com','guerrillamail.com','jetable.fr.nf',
  'nomail.pw','nospam.ze.tc','nowmymail.com','objectmail.com','obobbo.com',
  'oneoffemail.com','onewaymail.com','online.ms','opayq.com','ordinaryamerican.net',
  'otherinbox.com','ourklips.com','outlawspam.com','ovpn.to','owlpic.com',
  'pancakemail.com','paplease.com','pepbot.com','pepigu.com','pookmail.com',
  'privacy.net','proxymail.eu','prtnx.com','punkass.com','putthisinyourspamdatabase.com',
  'qq.com.w3internet.co.uk','rcpt.at','recode.me','regbypass.com','regbypass.comsafe-mail.net',
  'safetymail.info','safetypost.de','sandelf.de','saynotospams.com','selfdestructingmail.com',
  'sendspamhere.com','sharklasers.com','shieldemail.com','shitmail.me','shitware.nl',
  'skeefmail.com','slopsbox.com','smellfear.com','smwg.info','sneakemail.com',
  'sneakmail.de','snkmail.com','sofimail.com','sofort-mail.de','sogetthis.com',
  'spamcon.org','spamcorptastic.com','spamcowboy.com','spamcowboy.net','spamcowboy.org',
  'spamday.com','spamex.com','spamfree24.org','spamgoes.in','spamgourmet.com',
  'spaml.com','spaml.de','spammotel.com','spamoff.de','spamslicer.com',
  'spamstack.net','spamthis.co.uk','spamthisplease.com','spamtrail.com',
  'speed.1s.fr','spoofmail.de','stuffmail.de','super-auswahl.de','supergreatmail.com',
  'supermailer.jp','superrito.com','superstachel.de','suremail.info','susi.ml',
  'svk.jp','sweetxxx.de','tafmail.com','tagyourself.com','tank.viper.net.nz',
  'tapchicuoivui.com','temp-mail.org','temp-mail.ru','tempe-mail.com','tempemail.co.za',
  'tempemail.com','tempemail.net','tempemail.org','tempinbox.co.uk','tempinbox.com',
  'temporaryemail.net','temporaryforwarding.com','temporaryinbox.com',
  'temporarymailaddress.com','tempsky.com','tempthe.net','tempymail.com',
  'thanksnospam.info','thisisnotmyrealemail.com','throwam.com','throwaway.email',
  'tilien.com','tittbit.in','tmail.ws','tmailinator.com','toiea.com',
  'tradermail.info','trash-mail.at','trash-mail.com','trash-mail.de','trash-mail.io',
  'trash-mail.net','trash2009.com','trash2010.com','trash2011.com','trashemail.de',
  'trashimail.de','trashmail.at','trashmail.com','trashmail.me','trashmail.net',
  'trashmail.org','trashmailer.com','trashymail.com','trbvm.com','trialmail.de',
  'trocknen.de','tscool.net','ttszuo.xyz','twinmail.de','tyldd.com',
  'ubm.md','uggsrock.com','umail.net','uroid.com','us.af',
  'veryrealemail.com','viditag.com','vipmail.pw','vkcode.ru','vmani.com',
  'vomoto.com','vpn.st','vsimcard.com','vubby.com','walala.org',
  'walkmail.net','walkmail.ru','wetrainbayarea.org','whyspam.me','wickmail.net',
  'wilemail.com','willhackforfood.biz','wmail.cf','wollan.info','writeme.us',
  'wronghead.com','wuzupmail.net','www.e4ward.com','www.mailinator.com',
  'wwwnew.eu','xagloo.co','xagloo.com','xemaps.com','xents.com',
  'xmaily.com','xoxy.net','xyzfree.net','yapped.net','yep.it',
  'yepmail.net','yert.ye.vc','yogamaven.com','yopmail.com','yopmail.fr',
  'yopmail.gq','yourdomain.com','yuurok.com','z1p.biz','za.com',
  'zehnminuten.de','zehnminutenmail.de','zetmail.com','zippymail.in',
  'zoemail.net','zoemail.org','zomg.info','zxcv.com','zxcvbnm.com',
]);

export type ValidationResult = {
  valid: boolean;
  reason?: 'disposable' | 'no_mx' | 'invalid_format' | 'valid';
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MX_CACHE = new Map<string, boolean>();

async function resolveMxWithTimeout(domain: string): Promise<boolean> {
  return Promise.race([
    dns.resolveMx(domain).then(records => records.length > 0).catch(() => false),
    new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 5_000)),
  ]);
}

export async function validateEmail(email: string): Promise<ValidationResult> {
  if (!EMAIL_REGEX.test(email)) {
    return { valid: false, reason: 'invalid_format' };
  }

  const domain = email.split('@')[1].toLowerCase();

  if (DISPOSABLE_DOMAINS.has(domain)) {
    return { valid: false, reason: 'disposable' };
  }

  // MX record check with cache (TTL 1 hour for success, 5 min for failures)
  if (!MX_CACHE.has(domain)) {
    const hasMx = await resolveMxWithTimeout(domain);
    MX_CACHE.set(domain, hasMx);
    if (hasMx) {
      // Evict cache entry after 1 hour
      setTimeout(() => MX_CACHE.delete(domain), 3_600_000);
    } else {
      // Shorter TTL for negative results to allow recovery
      setTimeout(() => MX_CACHE.delete(domain), 5 * 60_000);
    }
  }

  if (!MX_CACHE.get(domain)) {
    return { valid: false, reason: 'no_mx' };
  }

  return { valid: true, reason: 'valid' };
}

export async function validateEmailBatch(emails: string[]): Promise<Map<string, ValidationResult>> {
  const results = new Map<string, ValidationResult>();
  await Promise.all(
    emails.map(async (email) => {
      results.set(email, await validateEmail(email));
    })
  );
  return results;
}

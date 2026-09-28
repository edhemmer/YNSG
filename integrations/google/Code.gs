// Only authorizeEmail is run manually. Website access fails closed until configured.
function authorizeEmail() {
  return MailApp.getRemainingDailyQuota();
}

function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}

function hex_(bytes) {
  return bytes.map(function (b) { return ('0' + (b & 255).toString(16)).slice(-2); }).join('');
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return json_({status: 'busy'});
  try {
    var props = PropertiesService.getScriptProperties();
    var secret = props.getProperty('YNSG_SHARED_SECRET');
    var recipient = props.getProperty('YNSG_RECIPIENT');
    if (!secret || secret.length < 40 || !recipient) return json_({status: 'unavailable'});
    if (!e || !e.postData || e.postData.contents.length > 24000) return json_({status: 'invalid'});
    var envelope = JSON.parse(e.postData.contents);
    if (typeof envelope.payload !== 'string' || typeof envelope.signature !== 'string') return json_({status: 'invalid'});
    var expected = hex_(Utilities.computeHmacSha256Signature(envelope.payload, secret));
    var difference = expected.length ^ envelope.signature.length;
    for (var i = 0; i < expected.length; i++) difference |= expected.charCodeAt(i) ^ (envelope.signature.charCodeAt(i) || 0);
    if (difference !== 0) return json_({status: 'denied'});
    var request = JSON.parse(envelope.payload);
    var now = Date.now();
    if (!Number.isFinite(request.timestamp) || Math.abs(now - request.timestamp) > 300000) return json_({status: 'expired'});
    if (!/^[a-f0-9-]{36}$/.test(request.id) || !/^[a-f0-9]{64}$/.test(request.clientHash)) return json_({status: 'invalid'});
    if (typeof request.body !== 'string' || request.body.length > 12000 || typeof request.replyTo !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(request.replyTo) || /[\r\n]/.test(request.replyTo)) return json_({status: 'invalid'});
    var digest = hex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, request.body + '\n' + request.replyTo));
    var key = 'request:' + request.id;
    var old = props.getProperty(key);
    if (old) {
      var prior = JSON.parse(old);
      if (prior.digest !== digest) return json_({status: 'conflict'});
      return json_({status: prior.status, reference: request.id});
    }
    // Expire metadata after seven days; no customer message is stored here.
    var all = props.getProperties();
    Object.keys(all).forEach(function (k) {
      if (k.indexOf('request:') === 0 || k.indexOf('limit:') === 0) {
        var record = JSON.parse(all[k]);
        if (record.expires < now) props.deleteProperty(k);
      }
    });
    var limits = [
      {key: 'limit:day:' + Math.floor(now / 86400000), max: 90, duration: 172800000},
      {key: 'limit:hour:' + Math.floor(now / 3600000), max: 20, duration: 7200000},
      {key: 'limit:client:' + request.clientHash + ':' + Math.floor(now / 3600000), max: 4, duration: 7200000}
    ];
    for (var n = 0; n < limits.length; n++) {
      var current = JSON.parse(props.getProperty(limits[n].key) || '{"count":0}');
      if (current.count >= limits[n].max) return json_({status: 'limited'});
    }
    if (MailApp.getRemainingDailyQuota() < 1) return json_({status: 'limited'});
    limits.forEach(function (limit) {
      var count = JSON.parse(props.getProperty(limit.key) || '{"count":0}').count;
      props.setProperty(limit.key, JSON.stringify({count: count + 1, expires: now + limit.duration}));
    });
    var state = {digest: digest, status: 'uncertain', expires: now + 604800000};
    props.setProperty(key, JSON.stringify(state));
    try {
      MailApp.sendEmail({to: recipient, subject: 'Your Neighborhood Service Guy New Request',
        body: request.body, replyTo: request.replyTo, name: 'Your Neighborhood Service Guy'});
      state.status = 'accepted';
      props.setProperty(key, JSON.stringify(state));
      return json_({status: 'accepted', reference: request.id});
    } catch (_) {
      // Never blindly resend after an uncertain provider response.
      return json_({status: 'uncertain', reference: request.id});
    }
  } catch (_) {
    return json_({status: 'unavailable'});
  } finally {
    lock.releaseLock();
  }
}

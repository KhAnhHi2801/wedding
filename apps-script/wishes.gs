/**
 * Google Apps Script web app lưu và đọc lời chúc trên Google Sheet.
 * Hướng dẫn cài đặt: docs/wishes-setup.md (cần runtime V8, mặc định của project mới).
 *
 * Script gắn với Sheet (Extensions > Apps Script), nên không cần ghi Sheet ID vào code.
 * Sheet tên "Wishes" có các cột: id | createdAt | name | message | status
 *   status = "visible": hiện công khai; mọi giá trị khác (vd. "hidden"): không hiện.
 * Kiểm duyệt = đổi status của dòng đó ngay trên Sheet. Đừng xóa hoặc sắp xếp lại dòng:
 * phân trang dùng số dòng làm con trỏ.
 */

var SHEET_NAME = 'Wishes';
var HEADERS = ['id', 'createdAt', 'name', 'message', 'status'];

var NAME_MAX = 40;
var MESSAGE_MIN = 2;
var MESSAGE_MAX = 300;
var MIN_FILL_MS = 3000; // khách điền form nhanh hơn mức này (hoặc không gửi elapsedMs) bị coi là bot
var RATE_LIMIT = 3; // số lời chúc tối đa mỗi mã trình duyệt...
var RATE_WINDOW_S = 600; // ...trong khoảng thời gian này (giây)
var DAILY_CAP = 500; // trần số lời chúc nhận mỗi ngày (toàn bộ)
var PAGE_MAX = 200;
var DEFAULT_LIMIT = 50;
var CACHE_TTL_S = 60;
var REQUEST_TTL_S = 600; // nhớ kết quả của một requestId để gửi lại không bị ghi trùng
var GENERATION_TTL_S = 21600; // tối đa của CacheService (6 giờ)
var TIME_ZONE = 'Asia/Ho_Chi_Minh';

// Bản sao của src/lib/profanity-list.ts (apps-script/wishes.test.ts kiểm tra hai bản giống nhau).
// Sửa danh sách thì sửa cả hai nơi.
var PROFANITY = [
  'đm',
  'đmm',
  'đcm',
  'đcmm',
  'dm',
  'dmm',
  'dcm',
  'dcmm',
  'vcl',
  'vkl',
  'lồn',
  'cặc',
  'địt',
  'đụ',
  'đéo',
  'đĩ',
  'fuck',
  'shit',
  'bitch',
  'buồi',
];

// ---------- chuẩn hóa và kiểm tra (bản sao của src/lib/wish-validation.ts) ----------

function clean_(raw) {
  // Gộp khoảng trắng (gồm xuống dòng) trước khi xóa ký tự vô hình, để "A\nB" thành "A B".
  return String(raw == null ? '' : raw)
    .normalize('NFC')
    .replace(/\s+/g, ' ')
    .replace(/[\p{Cc}\p{Cf}]/gu, '')
    .trim();
}

function length_(text) {
  return Array.from(text).length;
}

function isProfane_(text) {
  var words =
    ' ' +
    text
      .normalize('NFC')
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter(Boolean)
      .join(' ') +
    ' ';
  return PROFANITY.some(function (word) {
    return words.indexOf(' ' + word + ' ') !== -1;
  });
}

/** Trả về {ok:true,name,message,profane} hoặc {ok:false,error}. Từ chưa phù hợp không bị từ chối, chỉ bị ẩn. */
function validateWish_(name, message) {
  var n = clean_(name);
  var m = clean_(message);
  if (!n) return { ok: false, error: 'name_required' };
  if (length_(n) > NAME_MAX) return { ok: false, error: 'name_too_long' };
  if (length_(m) < MESSAGE_MIN) return { ok: false, error: 'message_too_short' };
  if (length_(m) > MESSAGE_MAX) return { ok: false, error: 'message_too_long' };
  return { ok: true, name: n, message: m, profane: isProfane_(n) || isProfane_(m) };
}

// ---------- chống công thức trong ô Sheet ----------

/**
 * Giá trị bắt đầu bằng = + - @ có thể bị Sheets hiểu là công thức khi ghi bằng setValues. Thêm một dấu cách
 * ở đầu: ô bắt đầu bằng dấu cách không bao giờ là công thức, dù định dạng ô thế nào. Dấu cách này được gỡ lại
 * khi đọc (unsanitizeCell_), và chuỗi đã được clean_ nên không bao giờ bắt đầu bằng dấu cách thật.
 */
function sanitizeCell_(text) {
  return /^[=+\-@]/.test(text) ? ' ' + text : text;
}

function unsanitizeCell_(cell) {
  var text = String(cell);
  return /^ [=+\-@]/.test(text) ? text.slice(1) : text;
}

// ---------- tiện ích ----------

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function jsonText_(text) {
  return ContentService.createTextOutput(text).setMimeType(ContentService.MimeType.JSON);
}

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/** Khóa cache kèm "thế hệ": tăng thế hệ khi có lời chúc mới là vô hiệu hóa mọi trang đã cache, bất kể limit. */
function cacheKey_(cache, limit, before) {
  return 'w:' + (cache.get('gen') || '0') + ':' + limit + ':' + before;
}

function bumpGeneration_(cache) {
  var next = (parseInt(cache.get('gen'), 10) || 0) + 1;
  safePut_(cache, 'gen', String(next), GENERATION_TTL_S);
}

/** CacheService từ chối giá trị > 100KB; cache chỉ là tối ưu nên lỗi ở đây không được làm hỏng yêu cầu. */
function safePut_(cache, key, value, ttl) {
  try {
    cache.put(key, value, ttl);
  } catch (err) {
    // bỏ qua
  }
}

// ---------- đọc ----------

function doGet(e) {
  try {
    var p = (e && e.parameter) || {};
    var limit = Math.min(Math.max(parseInt(p.limit, 10) || DEFAULT_LIMIT, 1), PAGE_MAX);
    var before = parseInt(p.before, 10) || 0; // con trỏ = số dòng; 0 = từ dòng mới nhất

    var cache = CacheService.getScriptCache();
    var key = cacheKey_(cache, limit, before);
    var cached = cache.get(key);
    if (cached) return jsonText_(cached);

    var sheet = getSheet_();
    var lastRow = sheet.getLastRow();
    var items = [];
    var nextCursor = null;

    if (lastRow >= 2) {
      var rows = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues(); // rows[i] là dòng i + 2
      var row = before > 1 ? Math.min(before - 1, lastRow) : lastRow;
      for (; row >= 2 && items.length < limit; row--) {
        var r = rows[row - 2];
        if (String(r[4]) === 'visible') {
          items.push({
            id: String(r[0]),
            createdAt: String(r[1]),
            name: unsanitizeCell_(r[2]),
            message: unsanitizeCell_(r[3]),
          });
        }
      }
      // Vòng lặp chỉ dừng khi hết dòng (row < 2) hoặc đã đủ `limit`. Còn dòng phía trước (row >= 2) nghĩa là
      // đã đủ `limit`: trả con trỏ cho trang cũ hơn.
      if (row >= 2) nextCursor = String(row + 1);
    }

    var body = JSON.stringify({ ok: true, items: items, nextCursor: nextCursor });
    safePut_(cache, key, body, CACHE_TTL_S);
    return jsonText_(body);
  } catch (err) {
    return json_({ ok: false, error: 'server' });
  }
}

// ---------- ghi ----------

function parseBody_(e) {
  try {
    var data = JSON.parse((e && e.postData && e.postData.contents) || '');
    return data && typeof data === 'object' ? data : null;
  } catch (err) {
    return null;
  }
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    var body = parseBody_(e);
    if (!body) return json_({ ok: false, error: 'invalid' });

    // Ô bẫy bot: giả vờ thành công để bot không biết bị chặn, nhưng không ghi gì.
    if (body.website) return json_({ ok: true, id: '', status: 'hidden' });

    var v = validateWish_(body.name, body.message);
    if (!v.ok) return json_({ ok: false, error: v.error });

    // Thiếu elapsedMs cũng bị coi là quá nhanh, để bot không né được bằng cách bỏ trường này.
    if (typeof body.elapsedMs !== 'number' || body.elapsedMs < MIN_FILL_MS) {
      return json_({ ok: false, error: 'too_fast' });
    }

    var token = String(body.token || '').slice(0, 64);
    if (!token) return json_({ ok: false, error: 'invalid' });
    var requestId = String(body.requestId || '').slice(0, 64);

    lock.waitLock(10000);

    var cache = CacheService.getScriptCache();

    // Gửi lại cùng một requestId (vd. lần trước quá thời gian chờ nhưng thực ra đã ghi): trả kết quả cũ, không ghi trùng.
    if (requestId) {
      var prior = cache.get('req:' + requestId);
      if (prior) return jsonText_(prior);
    }

    // Giới hạn theo mã trình duyệt: chỉ giảm spam ngẫu nhiên, mã này giả được nên không phải bảo mật.
    var rateKey = 'rl:' + token;
    var used = parseInt(cache.get(rateKey), 10) || 0;
    if (used >= RATE_LIMIT) return json_({ ok: false, error: 'rate_limited' });

    // Trần số lời chúc mỗi ngày cho toàn bộ trang.
    var props = PropertiesService.getScriptProperties();
    var dayKey = 'day:' + Utilities.formatDate(new Date(), TIME_ZONE, 'yyyy-MM-dd');
    var today = parseInt(props.getProperty(dayKey), 10) || 0;
    if (today >= DAILY_CAP) return json_({ ok: false, error: 'rate_limited' });

    var id = Utilities.getUuid();
    var status = v.profane ? 'hidden' : 'visible';
    var sheet = getSheet_();
    var row = sheet.getLastRow() + 1;
    // Định dạng văn bản thuần (@) và sanitizeCell_: hai lớp chống công thức như "=SUM(1,1)".
    var range = sheet.getRange(row, 1, 1, HEADERS.length);
    range.setNumberFormat('@');
    range.setValues([[id, new Date().toISOString(), sanitizeCell_(v.name), sanitizeCell_(v.message), status]]);

    safePut_(cache, rateKey, String(used + 1), RATE_WINDOW_S);
    props.setProperty(dayKey, String(today + 1));
    bumpGeneration_(cache); // mọi trang đã cache đều lấy lại dữ liệu mới

    var result = JSON.stringify({ ok: true, id: id, status: status });
    if (requestId) safePut_(cache, 'req:' + requestId, result, REQUEST_TTL_S);
    return jsonText_(result);
  } catch (err) {
    return json_({ ok: false, error: 'server' });
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}

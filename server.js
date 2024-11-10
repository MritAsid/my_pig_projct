const sqlite3 = require("sqlite3").verbose();
const bodyParser = require("body-parser");
const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const app = express();
const PORT = 3000;


/* ================== START SQL =========================
 إعداد قاعدة البيانات (SQLite)
==============================================  */
const db = new sqlite3.Database("./database.db", (err) => {
  if (err) {
    console.error("Error opening SQLite database:", err);
  } else {
    console.log("Connected to the SQLite database.");

    // إنشاء جدول العملاء إذا لم يكن موجودًا
    db.run(`CREATE TABLE IF NOT EXISTS clients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE
    )`);

    // إنشاء جدول المعاملات إذا لم يكن موجودًا
    db.run(`CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_name TEXT NOT NULL,
        amount REAL NOT NULL,
        details TEXT,
        transaction_type TEXT NOT NULL,
        date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (client_name) REFERENCES clients(name)
    )`);


    // إنشاء جدول أنواع الأعمال إذا لم يكن موجودًا
    db.run(`CREATE TABLE IF NOT EXISTS work_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    work_type TEXT NOT NULL,
    price REAL NOT NULL,
    work_id TEXT UNIQUE NOT NULL
)`);

    console.log("Tables created or verified successfully.");
  }
});
module.exports = db;

// استخدام body-parser لتفسير بيانات JSON
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));
 
//  ================== END SQL =========================

/* // ================= START ADD DELETE NEAM ========================
                    // إضافةاو حذف عميل جديد 
======================================================================*/

                    // إضافة عميل جديد 
app.post("/add-customer", (req, res) => {
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ message: "اسم العميل مطلوب" });
  }

  // التحقق من وجود العميل مسبقًا
  const checkQuery = `SELECT * FROM clients WHERE name = ?`;
  db.get(checkQuery, [name], (err, row) => {
    if (err) {
      return res.status(500).json({ message: "حدث خطأ أثناء التحقق من وجود العميل" });
    }

    if (row) {
      return res.status(400).json({ message: "هذا العميل موجود بالفعل" });
    }

    // إذا لم يكن موجودًا، يتم إضافة العميل
    const insertQuery = `INSERT INTO clients (name) VALUES (?)`;
    db.run(insertQuery, [name], function (err) {
      if (err) {
        return res.status(500).json({ message: "حدث خطأ أثناء إضافة العميل" });
      }
      res.json({ message: "تمت إضافة العميل بنجاح!" });
    });
  });
});
                    //  حذف عميل
app.post("/delete-customer", (req, res) => {
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ message: "اسم العميل مطلوب" });
  }

  // استعلام لحذف جميع العمليات المرتبطة بالعميل
  const deleteTransactionsQuery = `DELETE FROM transactions WHERE client_name = ?`;
  db.run(deleteTransactionsQuery, [name], function (err) {
    if (err) {
      return res.status(500).json({ message: "حدث خطأ أثناء حذف العمليات المرتبطة بالعميل" });
    }

    // استعلام لحذف العميل
    const deleteClientQuery = `DELETE FROM clients WHERE name = ?`;
    db.run(deleteClientQuery, [name], function (err) {
      if (err) {
        return res.status(500).json({ message: "حدث خطأ أثناء حذف العميل" });
      }
      if (this.changes === 0) {
        return res.status(404).json({ message: "العميل غير موجود" });
      }
      res.json({ message: "تم حذف العميل وجميع العمليات التابعة له بنجاح!" });
    });
  });
});
// جلب ارصدة العملاء
app.get("/api/get-client-balances", (req, res) => {
  const query = `
        SELECT clients.name AS client_name, 
               IFNULL(SUM(CASE WHEN transactions.transaction_type = 'add' THEN transactions.amount 
                              WHEN transactions.transaction_type = 'pay' THEN -transactions.amount 
                              ELSE 0 END), 0) AS balance
        FROM clients
        LEFT JOIN transactions ON clients.name = transactions.client_name
        GROUP BY clients.name
        ORDER BY clients.id
    `;

  db.all(query, (err, rows) => {
    if (err) {
      console.error("Error fetching balances:", err);
      res.status(500).json({ error: "Failed to fetch client balances" });
    } else {
      res.json(rows);
    }
  });
});
 // ================= END ADD DELETE NEAM ========================

/* ====================START TRANSACTION==========================
                        إضافة أو تسديد مبلغ
============================================================*/

app.post("/transaction", (req, res) => {
  const { name, amount, details, transactionType } = req.body;

  if (!name || !amount || !transactionType) {
    return res
      .status(400)
      .json({ success: false, message: "جميع الحقول مطلوبة" });
  }

  const query = `INSERT INTO transactions (client_name, amount, details, transaction_type) VALUES (?, ?, ?, ?)`;
  db.run(query, [name, amount, details, transactionType], function (err) {
    if (err) {
      return res
        .status(500)
        .json({ success: false, message: "حدث خطأ أثناء حفظ العملية" });
    }
    res.json({ success: true, message: "تم حفظ العملية بنجاح!" });
  });
});
//  ====================END TRANSACTION==========================

/* ===================START SEARCH===============================
                     البحث عن عميل
================================================================*/

// نقطة النهاية لجلب العملاء (الإكمال التلقائي)
app.get("/api/get-customers", (req, res) => {
  const query = `SELECT name FROM clients`;
  db.all(query, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ message: "حدث خطأ أثناء جلب العملاء" });
    }
    const customerNames = rows.map((row) => row.name);
    res.json(customerNames);
  });
});

// نقطة النهاية لجلب العمليات حسب اسم العميل
app.get("/api/get-transactions/:name", (req, res) => {
  const clientName = req.params.name;

  const query = `SELECT * FROM transactions WHERE client_name = ? ORDER BY date DESC`;
  db.all(query, [clientName], (err, rows) => {
    if (err) {
      return res.status(500).json({ message: "حدث خطأ أثناء جلب العمليات" });
    }
    if (rows.length === 0) {
      return res
        .status(404)
        .json({ message: "العميل غير موجود أو لا توجد عمليات" });
    }
    res.json(rows);
  });
});
// نقطة النهاية لجلب عملية واحدة (لأغراض التعديل)
app.get("/api/get-transaction/:id", (req, res) => {
  const transactionId = req.params.id;

  const query = `SELECT * FROM transactions WHERE id = ?`;
  db.get(query, [transactionId], (err, row) => {
    if (err) {
      return res.status(500).json({ message: "حدث خطأ أثناء جلب العملية" });
    }
    if (!row) {
      return res.status(404).json({ message: "العملية غير موجودة" });
    }
    res.json(row);
  });
});

// نقطة النهاية لتعديل عملية
app.post("/api/edit-transaction", (req, res) => {
  const { id, amount, details } = req.body;

  if (!id || !amount) {
    return res.status(400).json({ message: "جميع الحقول مطلوبة" });
  }

  const query = `UPDATE transactions SET amount = ?, details = ? WHERE id = ?`;
  db.run(query, [amount, details, id], function (err) {
    if (err) {
      return res.status(500).json({ message: "حدث خطأ أثناء تعديل العملية" });
    }
    if (this.changes === 0) {
      return res.status(404).json({ message: "العملية غير موجودة" });
    }
    res.json({ success: true, message: "تم تعديل العملية بنجاح" });
  });
});

// نقطة النهاية لحذف عملية
app.delete("/api/delete-transaction/:id", (req, res) => {
  const transactionId = req.params.id;

  const query = `DELETE FROM transactions WHERE id = ?`;
  db.run(query, [transactionId], function (err) {
    if (err) {
      return res.status(500).json({ message: "حدث خطأ أثناء حذف العملية" });
    }
    if (this.changes === 0) {
      return res.status(404).json({ message: "العملية غير موجودة" });
    }
    res.json({ success: true, message: "تم حذف العملية بنجاح" });
  });
});

//  نقطة النهاية لتوليد PDF
app.get("/api/transactions", (req, res) => {
  const clientName = req.query.client_name;
  const query = `SELECT * FROM transactions WHERE client_name = ? ORDER BY date DESC`;

  db.all(query, [clientName], (err, rows) => {
    if (err) {
      console.error("حدث خطأ أثناء جلب البيانات من قاعدة البيانات:", err);
      return res.status(500).json({ message: "حدث خطأ أثناء جلب العمليات" });
    }

    // console.log("البيانات المسترجعة من قاعدة البيانات:", rows); // طباعة البيانات في Console الخادم
    res.json(rows); // إعادة البيانات كـ JSON
  });
});
//  ===================END SEARCH===============================


/* ===================START INDEX===============================
                     الصفحة الرئيسية
================================================================*/
// نقطة نهاية لجلب عدد العملاء
app.get("/get-customer-count", (req, res) => {
  const query = `SELECT COUNT(*) AS count FROM clients`;
  db.get(query, [], (err, row) => {
    if (err) {
      return res.status(500).json({ message: "حدث خطأ أثناء جلب عدد العملاء" });
    }
    res.json({ count: row.count });
  });
});
//  ===================END INDEX===============================

/* ===================START WORKTYPES===============================
                       ادارة الاعمال  
================================================================*/
// إضافة عمل جديد
app.post("/add-work", (req, res) => {
  const { work_type, price, work_id } = req.body;

  const query = `INSERT INTO work_types (work_type, price, work_id) VALUES (?, ?, ?)`;
  db.run(query, [work_type, price, work_id], function (err) {
    if (err) {
      console.error("Error adding work type:", err.message);
      return res.status(500).json({ message: "حدث خطأ أثناء إضافة العمل" });
    }
    res.json({ message: "تم إضافة العمل بنجاح!" });
  });
});

// جلب كل أنواع الأعمال
app.get("/get-works", (req, res) => {
  const query = `SELECT * FROM work_types`;
  db.all(query, (err, rows) => {
    if (err) {
      console.error("Error fetching works:", err.message);
      return res.status(500).json({ message: "حدث خطأ أثناء جلب الأعمال" });
    }
    res.json(rows);
  });
});
//  حذف عمل 
app.post("/delete-work", (req, res) => {
  const { work_id } = req.body;
  console.log("Received work_id for deletion:", work_id); // تحقق من وصول work_id

  const query = `DELETE FROM work_types WHERE work_id = ?`;
  db.run(query, [work_id], function (err) {
    if (err) {
      console.error("Error deleting work:", err.message);
      return res.status(500).json({ message: "حدث خطأ أثناء حذف العمل" });
    }
    if (this.changes === 0) {
      return res.status(404).json({ message: "نوع العمل غير موجود" });
    }
    res.json({ message: "تم حذف العمل بنجاح!" });
  });
});

// ============================END  workTypes ==================================


/* ===================START PRODUCTS===============================
                    اضاقت معاملات نقدية 
================================================================*/

app.use(express.json());

// استرجاع أنواع الأعمال
app.get("/api/work_types", (req, res) => {
  db.all(`SELECT work_type, price FROM work_types`, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// // نقطة النهاية للتحقق من وجود العميل
// app.get('/check-customer', async (req, res) => {
//     const customerName = req.query.name;
    
//     try {
//         const result = await db.get(`SELECT COUNT(*) AS count FROM clients WHERE name = ?`, [customerName]);
//         const exists = result.count > 0;
//         res.json({ exists });
//     } catch (error) {
//         console.error("Error checking customer:", error);
//         res.status(500).json({ error: "Error checking customer" });
//     }
// });

// نقطة النهاية للتحقق من وجود العميل في قاعدة البيانات
app.get('/check-customer', (req, res) => {
    const customerName = req.query.name;

    // استعلام للتحقق من وجود العميل
    db.get(`SELECT * FROM clients WHERE name = ?`, [customerName], (err, row) => {
        if (err) {
            console.error("خطأ أثناء التحقق من وجود العميل:", err);
            res.status(500).json({ exists: false });
        } else {
            // إرسال النتيجة
            res.json({ exists: !!row });
        }
    });
});


//  ===================END PRODUCTS===============================

/* ===================START BACKUP===============================
                   النسخ الاحتياطي المحلي
================================================================*/
// إعداد multer لحفظ الملفات
const upload = multer({ dest: "uploads/" });
// مسار مجلد النسخ الاحتياطي على القرص D
const backupFolderPath = path.join("D:", "DatabaseBackups");
// إنشاء مجلد النسخ الاحتياطي إذا لم يكن موجودًا
if (!fs.existsSync(backupFolderPath)) {
  fs.mkdirSync(backupFolderPath, { recursive: true });
}
// دالة لإنشاء نسخة احتياطية
app.get('/api/backup', (req, res) => {
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const backupFileName = `backup-${timestamp}.sqlite`;
    const backupFilePath = path.join('D:', 'DatabaseBackups', backupFileName);

    fs.copyFile("./database.db", backupFilePath, (err) => {
        if (err) {
            console.error('Error creating backup:', err);
            return res.status(500).json({ message: 'Error creating backup' });
        }
        console.log('Database backup created successfully:', backupFilePath);
        res.json({
          message: "نجح   إنشاء النسخة الاحتياطية",          path: backupFilePath,
        });
    });
});
// دالة لاستيراد نسخة احتياطية
app.post("/api/restore", upload.single("backupFile"), (req, res) => {
  const backupFilePath = req.file.path;

  fs.copyFile(backupFilePath, "./database.db", (err) => {
    if (err) {
      console.error("Error restoring backup:", err);
      return res.status(500).json({ message: "Error restoring backup" });
    }
    console.log("Database restored successfully from backup:", backupFilePath);

    // حذف الملف المرفوع بعد الاستعادة
    fs.unlink(backupFilePath, (err) => {
      if (err) console.error("Error deleting uploaded backup file:", err);
    });

    res.json({ message: "Database restored successfully" });
  });
});
//  ===================END BACKUP===============================
/* ===================START BACKUP ON GOOGEL====================
                   النسخ الاحتياطي على قوقل
================================================================*/
const { OAuth2Client } = require("google-auth-library");
const CLIENT_ID = "YOUR_GOOGLE_CLIENT_ID";
const client = new OAuth2Client(CLIENT_ID);
app.use(express.json());
// API لتسجيل الدخول باستخدام Google
app.post("/api/google-login", async (req, res) => {
  const { credential } = req.body;

  try {
    // تحقق من الرمز المميز مع Google
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const email = payload.email;

    // تحقق من وجود المستخدم في قاعدة البيانات، أو أضفه إذا كان جديدًا
    db.get("SELECT * FROM users WHERE email = ?", [email], (err, user) => {
      if (err) {
        return res
          .status(500)
          .json({ success: false, message: "خطأ في قاعدة البيانات" });
      }

      if (!user) {
        // إذا كان المستخدم جديدًا، أضفه إلى قاعدة البيانات
        db.run("INSERT INTO users (email) VALUES (?)", [email], (err) => {
          if (err)
            return res
              .status(500)
              .json({ success: false, message: "خطأ في إضافة المستخدم" });
          res.json({ success: true });
        });
      } else {
        // المستخدم موجود مسبقًا، سجل دخوله
        res.json({ success: true });
      }
    });
  } catch (error) {
    console.error("Error verifying Google token:", error);
    res.status(401).json({ success: false, message: "فشل التحقق من الرمز" });
  }
});
//  ===================START BACKUP ON GOOGEL====================
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname,"public", "index.html"));
});
// ======================
// بدء السيرفر
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

const express = require("express");
const mysql = require("mysql");
const app = express();
const cors = require("cors");
const multer = require("multer");
var bodyParser = require("body-parser");
var jsonParser = bodyParser.json();
const bcrypt = require("bcrypt");
const saltRounds = 10;
var jwt = require("jsonwebtoken");
const secret = "Fullstack-Login-2021";

//======================================= connect DataBase ================================//
const connection = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "appointments",
});

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  next();
});
app.use(cors());
app.use(express.json());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

//========================= Check Connection ======================//
connection.connect((err) => {
  if (err) {
    console.log("Erroro connecting to MySql database = ", err);
    return;
  }
  console.log("MySql successfully Connected!");
});
//======================================== login =======================================//
app.post("/login", jsonParser, function (req, res, next) {
  console.log(req.body.identificationNumber);
  connection.query(
    " SELECT * FROM `customers` WHERE identificationNumber  =?",
    [req.body.identificationNumber],
    function (err, users, fields) {
      if (err) {
        res.json({ status: "error", message: err });
        return;
      }
      if (users.length == 0) {
        res.json({ status: "error", message: "no user found" });
        return;
      }
      console.log(users[0]);
      bcrypt.compare(
        req.body.password,
        users[0].password,
        function (err, isLogin) {
          if (isLogin) {
            var token = jwt.sign(
              {
                identificationNumber: users[0].identificationNumber,
                firstName: users[0].firstName,
                lastName: users[0].lastName,
                hospitalNumber: users[0].hospitalNumber,
              },
              secret,
              {
                expiresIn: "1h",
              }
            );
            res.json({ status: "ok", message: "login success", token });
          } else {
            res.json({ status: "error", message: "login failed" });
          }
        }
      );
    }
  );
});
//======================= เช็ค การหมดอายุ Token ============================//
app.post("/authen", jsonParser, function (req, res, next) {
  try {
    const token = req.headers.authorization.split(" ")[1];
    var decoded = jwt.verify(token, secret);
    res.json({ status: "ok", decoded });
  } catch (err) {
    res.json({ status: "error", message: err.message });
  }
});
//============================== get selecte Appointment =================================//
app.get("/api/readAppointment", (req, res) => {
  const hospitalNumber = req.query.hospitalNumber;
  const sql = `
    SELECT appoint.*, appoint_status.status,customer.firstName,customer.lastName
    FROM appointment appoint
    LEFT JOIN appointment_status appoint_status ON appoint.id = appoint_status.appointment_id
    LEFT JOIN customers customer ON appoint.hospitalNumber = customer.hospitalNumber
    WHERE appoint.hospitalNumber = ?
    ORDER BY appoint.created_at DESC;
    `;

  connection.query(sql, [hospitalNumber], (err, results, fields) => {
    if (err) {
      console.log(err);
      return res.status(400).send();
    }
    res.status(200).json(results);
  });
});

//================================ get Count Status  ==========================================//
app.get("/api/CountStatus", (req, res) => {
  const sqlQuery = `SELECT
    (SELECT COUNT(id) FROM appointment) AS totalAppointment,
    (SELECT COUNT(appoint_status.status) 
     FROM appointment appoint
     LEFT JOIN appointment_status appoint_status ON appoint.id = appoint_status.appointment_id
     WHERE appoint_status.status = 'confirmed'
     AND DATE(appoint.created_at) = CURDATE()) AS confirmedCount,
    (SELECT COUNT(status) FROM appointment_status WHERE status = "pending") AS pending_count;`;
  
  connection.query(sqlQuery, (err, results) => {
    if (err) {
      console.error("Error executing query:", err);
      res.status(500).json({ error: "Internal Server Error" });
      return;
    }
    
    const totalAppointment = results[0].totalAppointment.toString();
    const confirmedCount = results[0].confirmedCount.toString();
    const pendingCount = results[0].pending_count.toString();
    const data = { totalAppointment, confirmedCount, pendingCount };
    res.json(data);
    console.log(data);
  });
});

//================================ get status Pending Appointments  ==========================================//
app.get("/api/pending-count", (req, res) => {
  const sqlQuery =
    "SELECT COUNT(*) AS pending_count FROM appointment_status WHERE status = ?";
  const statusToCount = "Pending";

  connection.query(sqlQuery, [statusToCount], (err, results) => {
    if (err) {
      console.error("Error executing query:", err);
      res.status(500).json({ error: "Internal Server Error" });
      return;
    }

    const pendingCount = results[0].pending_count;
    res.json({ pendingCount });
  });
});
//================================================== all-data test ====================================//
app.get("/all-data", (req, res) => {
  const sql = "  SELECT * FROM appointment";
  connection.query(sql, (err, results, fields) => {
    if (err) {
      console.log(err);
      return res.status(400).send();
    }
    res.status(200).json(results);
  });
});
//================================ get status Today's Appointments  ==========================================//
app.get("/api/confirmedToday", (req, res) => {
  const sqlQuery = `SELECT COUNT(*) AS confirmedCount
  FROM appointment a
  LEFT JOIN appointment_status s ON a.id = s.appointment_id
  WHERE s.status = 'confirmed'
  AND DATE(a.created_at) = CURDATE();`;

  connection.query(sqlQuery, (err, results) => {
    if (err) {
      console.error("Error executing query:", err);
      res.status(500).json({ error: "Internal Server Error" });
      return;
    }
    res.json({ results });
  });
});
//================================ get total  ==========================================//
app.get("/api/totalAppointment", (req, res) => {
  const sqlQuery = `SELECT COUNT(id) AS totalAppointment FROM appointment; `;

  connection.query(sqlQuery, (err, results) => {
    if (err) {
      console.error("Error executing query:", err);
      res.status(500).json({ error: "Internal Server Error" });
      return;
    }
    res.json({ results });
  });
});
//============================== get selecte Status =================================//
app.get("/api/readStatus", (req, res) => {
  const sql = `
      SELECT * FROM \`status\`
    `;
  connection.query(sql, (err, results, fields) => {
    if (err) {
      console.log(err);
      return res.status(400).send();
    }
    res.status(200).json(results);
  });
});

//================================== get all province ==============================//
app.get("/api/readProvince", async (req, res) => {
  try {
    connection.query("SELECT * FROM provinces", (err, results, fields) => {
      if (err) {
        console.log(err);
        return res.status(400).send();
      }
      res.status(200).json(results);
    });
  } catch (err) {
    console.log(err);
    return res.status(500).send();
  }
});

//================================== get all amphures ==============================//
app.get("/api/readAmphures", async (req, res) => {
  try {
    const provinceName = req.query.provinceName; // รับค่าชื่อจังหวัดที่ต้องการค้นหาจาก query string
    console.log(provinceName);
    connection.query(
      "SELECT amphures.* FROM provinces JOIN amphures ON provinces.id = amphures.province_id WHERE provinces.id = ? ; ",
      [provinceName], // ส่งพารามิเตอร์เข้าไปใน query
      (err, results, fields) => {
        if (err) {
          console.log(err);
          return res.status(400).send();
        }
        res.status(200).json(results);
      }
    );
  } catch (err) {
    console.log(err);
    return res.status(500).send();
  }
});

//================================== get all districts ==============================//
app.get("/api/readDistricts", async (req, res) => {
  try {
    const provinceName = req.query.provinceName; // รับค่าชื่อจังหวัดที่ต้องการค้นหาจาก query string
    console.log(provinceName);
    connection.query(
      "SELECT districts.* FROM amphures JOIN districts ON amphures.id = districts.amphure_id WHERE amphures.id = ?; ",
      [provinceName], // ส่งพารามิเตอร์เข้าไปใน query
      (err, results, fields) => {
        if (err) {
          console.log(err);
          return res.status(400).send();
        }
        res.status(200).json(results);
      }
    );
  } catch (err) {
    console.log(err);
    return res.status(500).send();
  }
});
//================================== get all PostalCodes ==============================//

app.get("/api/readPostalCodes", async (req, res) => {
  try {
    const provinceName = req.query.provinceName; // รับค่า ID ของอำเภอที่ต้องการค้นหารหัสไปรษณีย์จาก query string
    connection.query(
      "SELECT * FROM districts WHERE amphure_id = ? GROUP BY zip_code; ",
      [provinceName], // ส่งพารามิเตอร์เข้าไปใน query
      (err, results, fields) => {
        if (err) {
          console.log(err);
          return res.status(400).send();
        }
        res.status(200).json(results);
      }
    );
  } catch (err) {
    console.log(err);
    return res.status(500).send();
  }
});
//======================================= addAppointment ====================================//
app.post("/api/addAppointment", (req, res) => {
  const {
    hospitalNumber,
    appointmentDate,
    appointmentTime,
    selectClinic,
    selectDoctor,
    description,
  } = req.body;

  const sqlAppointment =
    "INSERT INTO appointment (hospitalNumber, date_appointment, time_appointment, clinic, doctor, description, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())";
  const valuesAppointment = [
    hospitalNumber,
    appointmentDate,
    appointmentTime,
    selectClinic,
    selectDoctor,
    description,
  ];

  connection.query(
    sqlAppointment,
    valuesAppointment,
    function (err, results, fields) {
      if (err) {
        console.error(
          "เกิดข้อผิดพลาดในการเพิ่มข้อมูลในฐานข้อมูล: " + err.stack
        );
        res.status(500).json({ status: "error", message: "Database error" });
        return;
      }

      // หากการเพิ่มข้อมูลในตาราง appointment สำเร็จ ให้เพิ่มสถานะในตาราง appointment_status
      const appointmentId = results.insertId; // ดึงค่า ID ที่เพิ่มลงในตาราง appointment
      console.log(appointmentId);
      const sqlStatus =
        "INSERT INTO appointment_status (appointment_id, status, created_at) VALUES (?, 'pending', NOW())";
      const valuesStatus = [appointmentId];

      connection.query(
        sqlStatus,
        valuesStatus,
        function (err, statusResults, fields) {
          if (err) {
            console.error(
              "เกิดข้อผิดพลาดในการเพิ่มสถานะในฐานข้อมูล: " + err.stack
            );
            res
              .status(500)
              .json({ status: "error", message: "Database error" });
            return;
          }
          console.log("เพิ่มข้อมูลในฐานข้อมูลสำเร็จ", valuesStatus.status);
          res.json({ status: "ok" });
        }
      );
    }
  );
});

//==================================== updateAppointment =======================//
app.put("/api/updateAppointment/:id", (req, res) => {
  const employeeId = req.params.id;
  const {
    hospitalNumber,
    date_appointment,
    time_appointment,
    clinic,
    doctor,
    status,
  } = req.body;
  console.log(req.body);
  const sqlAppointment = `
      UPDATE appointment
      SET date_appointment=?, time_appointment=?, clinic=?, doctor=?
      WHERE id=?
    `;
  const valuesAppointment = [
    date_appointment,
    time_appointment,
    clinic,
    doctor,
    employeeId, // นำ ID ที่ได้จาก URL Params มาใช้ใน WHERE ในการอัปเดตข้อมูล
  ];
  console.log(valuesAppointment);
  connection.query(
    sqlAppointment,
    valuesAppointment,
    function (err, results, fields) {
      if (err) {
        console.error(
          "เกิดข้อผิดพลาดในการอัปเดตข้อมูลในฐานข้อมูล: " + err.stack
        );
        res.status(500).json({ status: "error", message: "Database error" });
        return;
      }

      // หากการอัปเดตข้อมูลสำเร็จ ให้อัปเดตสถานะในตาราง appointment_status
      const sqlStatus = `
        UPDATE appointment_status
        SET status=?
        WHERE appointment_id=?
      `;
      const valuesStatus = [status, employeeId];

      connection.query(
        sqlStatus,
        valuesStatus,
        function (err, statusResults, fields) {
          if (err) {
            console.error(
              "เกิดข้อผิดพลาดในการอัปเดตสถานะในฐานข้อมูล: " + err.stack
            );
            res
              .status(500)
              .json({ status: "error", message: "Database error" });
            return;
          }

          console.log("อัปเดตข้อมูลในฐานข้อมูลสำเร็จ");
          res.json({ status: "ok" });
        }
      );
    }
  );
});

//===================================== Insert Customer ==========================================//
app.post("/api/insertCustomer", (req, res) => {
  // ดึงข้อมูลที่ต้องการจาก body ของ request
  const formData = req.body;

  // ตรวจสอบว่ามีข้อมูลที่ส่งมาหรือไม่
  if (!formData) {
    return res.status(400).json({ error: "Bad Request" });
  }

  // เข้ารหัสรหัสผ่านก่อนทำการบันทึกลงฐานข้อมูล
  bcrypt.hash(req.body.password, saltRounds, function (err, hash) {
    if (err) {
      console.error("Error hashing password:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }

    // ทำการบันทึกข้อมูลผู้ใช้งานลงในฐานข้อมูล
    const sql =
      "INSERT INTO customers ( identificationType, identificationNumber, hospitalNumber, gender, prefix, firstName, lastName, birthDate, address, moo, subDistrict, district, province, postalCode, mobile, homePhone, email, password) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
    const values = [
      formData.identificationType,
      formData.identificationNumber,
      formData.hospitalNumber,
      formData.gender,
      formData.prefix,
      formData.firstName,
      formData.lastName,
      formData.birthDate,
      formData.address,
      formData.moo,
      formData.subDistrict,
      formData.district,
      formData.province,
      formData.postalCode,
      formData.mobile,
      formData.homePhone,
      formData.email,
      hash, // เก็บรหัสผ่านที่ถูกเข้ารหัสไว้แทน
    ];
    connection.query(sql, values, (error, results, fields) => {
      if (error) {
        console.error("Error executing query:", error);
        return res.status(500).json({ error: "Internal Server Error" });
      }
      console.log("Data inserted successfully!");
      console.log(results);
      res.status(200).json({ message: "Data inserted successfully!" });
    });
  });
});
//========================================= Search  Dashboard =============================//
app.post("/api/search", (req, res) => {
  const { hospitalNumber, firstName, lastName, startDate, endDate } = req.body;

  // สร้างเงื่อนไขการค้นหาที่ต้องการใช้ใน query
  let conditions = [];
  let params = [];
  console.log(hospitalNumber, firstName, lastName, startDate, endDate);
  if (hospitalNumber) {
    conditions.push("appoint.hospitalNumber = ?");
    params.push(`${hospitalNumber}`);
  }

  if (firstName) {
    conditions.push("firstName = ?");
    params.push(`${firstName}`);
  }

  if (lastName) {
    conditions.push("lastName = ?");
    params.push(`${lastName}`);
  }

  if (startDate && endDate) {
    conditions.push("date_appointment BETWEEN ? AND ?");
    params.push(startDate, endDate);
  }

  // ตรวจสอบว่ามีเงื่อนไขการค้นหาหรือไม่
  const hasConditions = conditions.length > 0;

  // สร้าง query โดยใช้เงื่อนไขการค้นหาที่สร้างขึ้น
  const query = `
  SELECT appoint.hospitalNumber, appoint.date_appointment, appoint.time_appointment,
  appoint.clinic, appoint.doctor, appoint.description, appoint.created_at, appoint_status.status,
    customer.firstName, customer.lastName
  FROM appointment appoint
  LEFT JOIN appointment_status appoint_status ON appoint.id = appoint_status.appointment_id
  LEFT JOIN customers customer ON appoint.hospitalNumber = customer.hospitalNumber
    ${hasConditions ? "WHERE " + conditions.join(" AND ") : ""}
    GROUP BY appoint.created_at DESC;
  `;

  connection.query(query, params, (err, results) => {
    if (err) {
      console.error(err);
      res.status(500).json({ error: "An error occurred while searching." });
    } else {
      res.json({ result: results });
    }
  });
});

//============================== get selecte Appointment In table =================================//
const moment = require("moment"); // นำเข้า Moment.js
app.get("/api/readAppointmentALL", (req, res) => {
  const sql = `
  SELECT appoint.*, appoint_status.status, customer.firstName, customer.lastName FROM appointment appoint LEFT JOIN appointment_status appoint_status ON appoint.id = appoint_status.appointment_id LEFT JOIN customers customer ON appoint.hospitalNumber = customer.hospitalNumber GROUP BY appoint.created_at DESC; 
  `;
  connection.query(sql, (err, results, fields) => {
    if (err) {
      console.log(err);
      return res.status(400).send();
    }
    // แปลงวันที่ที่มีเวลาติดมาด้วยให้เหลือแค่วันที่เดือนปี
    const formattedResults = results.map((result) => {
      return {
        ...result,
        date_appointment: moment(result.date_appointment).format("YYYY-MM-DD"),
      };
    });
    res.status(200).json(formattedResults);
  });
});

app.listen(3000, function () {
  console.log("CORS-enabled web server listening on port 3000");
});

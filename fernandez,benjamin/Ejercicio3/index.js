import express from "express";
import mysql from "mysql2/promise";
import { body, param, validationResult } from "express-validator";

const port = 3000;
const app = express();
app.use(express.json());

// Conexión a base de datos
const db = await mysql.createConnection({
  host: process.env.DB_host,
  user: process.env.DB_user,
  password: process.env.DB_password,
  database: process.env.database,
});

    // if (db){
    //     console.log("it's working")
    // }

// --- VALIDACIONES ---
const verificarValidaciones = (req, res, next) => {
  const validacion = validationResult(req);
  if (!validacion.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Falla de validación",
      errores: validacion.array(),
    });
  }
  next();
};

const validarAlumno = [
  body("nombre").isAlpha("es-ES").isLength({ max: 50 }).withMessage("El nombre puede tener hasta 50 caracteres"),
  body("materia_id").isInt({ min: 1 }).withMessage("El id de la materia debe ser entero positivo").toInt(),
  body("nota1").isFloat({ min: 0, max: 10 }).withMessage("nota1 debe estar entre 0 y 10").toFloat(),
  body("nota2").isFloat({ min: 0, max: 10 }).withMessage("nota2 debe estar entre 0 y 10").toFloat(),
  body("nota3").isFloat({ min: 0, max: 10 }).withMessage("nota3 debe estar entre 0 y 10").toFloat(),
];

const validarId = [
  param("id")
    .isInt({ min: 1 })
    .withMessage("El id debe ser un entero positivo")
    .toInt(),
];

// --- HELPERS ---
// Verifica si ya existe un alumno con el mismo nombre en la misma materia
async function existeAlumno(nombre, materia_id, excludeId = null) {
  let rows;
  if (excludeId) {
    [rows] = await db.execute(
      "SELECT id FROM alumnos WHERE nombre = ? AND materia_id = ? AND id <> ? LIMIT 1",
      [nombre, materia_id, excludeId]
    );
  } else {
    [rows] = await db.execute(
      "SELECT id FROM alumnos WHERE nombre = ? AND materia_id = ? LIMIT 1",
      [nombre, materia_id]
    );
  }
  return rows.length > 0;
}

// --- ENDPOINTS ---

// Crear materia
app.post("/materias", 
  body("nombre").trim().notEmpty().withMessage("El nombre de la materia es obligatorio"), 
  verificarValidaciones,
  async (req, res) => {
    const { nombre } = req.body;
    const [result] = await db.execute("INSERT INTO materias (nombre) VALUES (?)", [nombre]);
    res.status(201).json({ success: true, data: { id: result.insertId, nombre } });
});

// Crear alumno
app.post("/alumnos", validarAlumno, verificarValidaciones, async (req, res) => {
  const { nombre, materia_id, nota1, nota2, nota3 } = req.body;

  // verificar materia existe
  const [materiaRows] = await db.execute("SELECT * FROM materias WHERE id = ?", [materia_id]);
  if (materiaRows.length === 0) {
    return res.status(400).json({ success: false, message: "La materia no existe" });
  }

  // verificar duplicado
  if (await existeAlumno(nombre, materia_id)) {
    return res.status(409).json({ success: false, message: "Ya existe un alumno con ese nombre en esa materia" });
  }

  const [result] = await db.execute(
    "INSERT INTO alumnos (nombre, materia_id, nota1, nota2, nota3) VALUES (?, ?, ?, ?, ?)",
    [nombre, materia_id, nota1, nota2, nota3]
  );

  return res.status(201).json({
    success: true,
    data: { id: result.insertId, nombre, materia_id, nota1, nota2, nota3 },
  });
});

// Listar alumnos con su materia
app.get("/alumnos", async (req, res) => {
  const [rows] = await db.execute(
    `SELECT a.id, a.nombre, a.nota1, a.nota2, a.nota3, m.nombre AS materia
     FROM alumnos a
     JOIN materias m ON a.materia_id = m.id`
  );
  return res.json({ success: true, data: rows });
});

// Modificar alumno
app.put("/alumnos/:id", validarId, validarAlumno, verificarValidaciones, async (req, res) => {
  const id = req.params.id;
  const { nombre, materia_id, nota1, nota2, nota3 } = req.body;

  const [rows] = await db.execute("SELECT * FROM alumnos WHERE id = ?", [id]);
  if (rows.length === 0) {
    return res.status(404).json({ success: false, message: "Alumno no encontrado" });
  }

  // verificar materia existe
  const [materiaRows] = await db.execute("SELECT * FROM materias WHERE id = ?", [materia_id]);
  if (materiaRows.length === 0) {
    return res.status(400).json({ success: false, message: "La materia no existe" });
  }

  // verificar duplicado
  if (await existeAlumno(nombre, materia_id, id)) {
    return res.status(409).json({ success: false, message: "Ya existe otro alumno con ese nombre en esa materia" });
  }

  await db.execute(
    "UPDATE alumnos SET nombre = ?, materia_id = ?, nota1 = ?, nota2 = ?, nota3 = ? WHERE id = ?",
    [nombre, materia_id, nota1, nota2, nota3, id]
  );

  return res.json({
    success: true,
    data: { id, nombre, materia_id, nota1, nota2, nota3 },
  });
});

// Listar materias
app.get("/materias", async (req, res) => {
  const [rows] = await db.execute("SELECT * FROM materias");
  return res.json({ success: true, data: rows });
});

app.listen(port, () => {
  console.log(`La aplicación esta funcionando en ${port}`);
});
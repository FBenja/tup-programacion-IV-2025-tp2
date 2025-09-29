import express from "express";
import mysql from "mysql2/promise";
import { body, param, query, validationResult } from "express-validator";

const port = 3000
const app = express();
app.use(express.json());


//conexion a base de datos
const db = await mysql.createConnection({
  host: process.env.DB_host, 
  user: process.env.DB_user, 
  password: process.env.DB_password, 
  database: process.env.database
});
// if(db){
//     console.log("existe")
// }else {
//     console.log("mal ahí")
// }

//Validaciones!
const verificarValidaciones = (req, res, next) => {
  const validacion = validationResult(req);
  if (!validacion.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Falla de validacion",
      errores: validacion.array(),
    });
  }
  next();
};

const validarName = [
    body("name").isAlpha("es-ES").isLength({ max: 50 }).withMessage("El nombre puede tener hasta 50 caracteres"),
  ]

const validarCompleted =[body("completada").optional().isBoolean().withMessage("completada debe ser true o false").toBoolean()]

const validarId = [param("id").isInt({ min: 1 }).withMessage("id debe ser entero positivo").toInt()]

const validarCompletedQuery = [query("completada").optional().isBoolean().withMessage("completada debe ser true o false").toBoolean()]

async function existeTareaConNombre(nombre, excludeId = null) {
  if (excludeId) {
    const [rows] = await db.execute(
      "SELECT id FROM tareas WHERE name = ? AND id <> ? LIMIT 1",
      [nombre, excludeId]
    );
    return rows.length > 0;
  } else {
    const [rows] = await db.execute(
      "SELECT id FROM tareas WHERE name = ? LIMIT 1",
      [nombre]
    );
    return rows.length > 0;
  }
}

app.post("/tareas",validarName,validarCompleted,verificarValidaciones, async(req,res)=>{
    const {name} = req.body
    const completada = req.body.completada ?? false;

    if (await existeTareaConNombre(name)) {
        return res.status(400).json({
          success: false,
          message: "Ya existe una tarea con ese nombre",
        });
        }

        const [result] = await db.execute(
        "INSERT INTO tareas (name, completada) VALUES (?, ?)",
        [name, completada ? 1 : 0]
      );
      return res
      .status(201)
      .json({
        success: true,
        data: { id: result.insertId, name, completada }
      })
    }
)

//GET TAREAS
app.get("/tareas",validarCompletedQuery,verificarValidaciones,async(req,res)=>{
    const { completada } = req.query;
      let rows;
      if (typeof completada !== "undefined") {
        const val = completada ? 1 : 0;
        [rows] = await db.execute("SELECT * FROM tareas WHERE completada = ?", [
          val,
        ]);
      } else {
        [rows] = await db.execute("SELECT * FROM tareas");
      }
      const data = rows.map((r) => ({
        id: r.id,
        name: r.name,
        completada: Boolean(r.completada)}))

        return res  
        .json({success:true,data})
})






//MODIFICAR TAREAS 
 app.put("/tareas/:id",validarId,validarName,validarCompleted,verificarValidaciones,async (req, res) => {
    
      const id = req.params.id;
      const { name } = req.body;
      const completada = req.body.completada;

      // Verificar existencia
      const [rows] = await db.execute("SELECT * FROM tareas WHERE id = ?", [id]);
      if (rows.length === 0) {
        return res.status(404).json({ success: false, message: "Tarea no encontrada" });
      }

      // Si cambian el nombre, verificar duplicado (excluyendo misma id)
      if (typeof name !== "undefined" && (await existeTareaConNombre(name, id))) {
        return res.status(400).json({
          success: false,
          message: "Ya existe otra tarea con ese nombre",
        });
      }

      // Construir query dinámico
      const updates = [];
      const params = [];
      if (typeof name !== "undefined") {
        updates.push("name = ?");
        params.push(name);
      }
      if (typeof completada !== "undefined") {
        updates.push("completada = ?");
        params.push(completada ? 1 : 0);
      }

      if (updates.length === 0) {
        return res.status(400).json({ success: false, message: "Nada para actualizar" });
      }

      params.push(id); // para WHERE
      await db.execute(`UPDATE tareas SET ${updates.join(", ")} WHERE id = ?`, params);

      // Devolver tarea actualizada
      const [updatedRows] = await db.execute("SELECT * FROM tareas WHERE id = ?", [id]);
      const r = updatedRows[0];
      return res.json({
        success: true,
        data: { id: r.id, name: r.name, completada: Boolean(r.completada) },
      });
    }  
  
);




app.listen(port, () => {
  console.log(`La aplicación esta funcionando en ${port}`);
});
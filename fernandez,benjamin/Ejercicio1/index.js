import express from "express"
import {body,param,query,validationResult} from "express-validator"
import mysql from "mysql2/promise"


const port = 3000
const app = express();

// Para interpretar body como JSON
app.use(express.json());


//conexion a la base de datos
const db = await mysql.createConnection({
  host: process.env.DB_host, 
  user: process.env.DB_user, 
  password: process.env.DB_password, 
  database: process.env.database
});
// if(db){
//     console.log("conexion exitosa")
// }else{
//     console.log("fallo en la conexion")
// }
app.get("/rectangulos",async(req,res)=>{
    const [rows] =await db.execute("SELECT * FROM rectangulos")
    res.json({success:true, data:rows})
})




//Validaciones
const validarId = [
    param("id").isInt({min:1}).withMessage("El id debe ser un número entero")]

const validarBody= [
    body("base").toInt().isInt({ min: 1 }).withMessage("la base debe ser mayor a 0"),
    body("altura").toInt().isInt({ min : 1 }).withMessage("la altura debe ser mayor a 0"),
  ]


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


//funcion para calcular superficie y parametro
function calcular(base, altura) {
  const perimetro = 2 * (base + altura);
  const superficie = base * altura;
  return { perimetro, superficie };
}



//post para ingresar base y altura
app.post("/rectangulos",validarBody,verificarValidaciones,async(req,res)=>{

   const {base,altura} = req.body
   const {perimetro,superficie} = calcular(base,altura)

   const [result] = await db.execute(
        "INSERT INTO rectangulos (base, altura, perimetro, superficie) VALUES (?, ?, ?, ?)",
        [base, altura, perimetro, superficie]
    );
    res.status(201).json({
    success: true,
    data: { id: result.insertId, base, altura,perimetro,superficie},
  });
        
})

//Modificar un rectangulo
app.put("/rectangulos/:id",validarId, validarBody,verificarValidaciones, async (req, res) => {
  
  const id = Number(req.params.id);

  const { base, altura} = req.body;

  await db.execute(
    "UPDATE rectangulos SET base=?, altura=? WHERE id=?",
    [base, altura, id]
  );

  res.json({
    success: true,
    data: { id, base, altura},
  });
});


    
//BORRAR UN RECTANGULO 
app.delete("/rectangulos/:id",validarId,verificarValidaciones,async (req, res) => {
    const id = Number(req.params.id)

    await db.execute("DELETE FROM rectangulos WHERE id=?", [id]);
    res.json({ success: true, data: id });
  })




app.listen(port, () => {
  console.log(`La aplicación esta funcionando en ${port}`);
});
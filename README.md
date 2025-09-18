# 🕹️ reportes-ss-generator  

[![Angular](https://img.shields.io/badge/Angular-%5E20.2.0-red)](https://angular.dev/) 
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9.2-blue)](https://www.typescriptlang.org/) 
[![Licencia MIT](https://img.shields.io/badge/Licencia-MIT-green)](LICENSE)

🔗 **[⚡ Ver Demo en Vivo](https://mik318.github.io/reportes-ss-generator/)**  

---

## 🚨 ¿Qué rayos es esto?

Bienvenido, **agente del servicio social** 👩‍💻👨‍💻.  
Este proyecto es tu **arma secreta** para sobrevivir a la burocracia:  

📑 Genera **reportes mensuales** de tu servicio social sin sudar, y evitar que te los regresen a cada rato.  
🤖 Deja que la app haga la **chamba repetitiva**: horas, días, periodos, todo calculado.  
⚡ Al final, un **PDF de misión cumplida** listo para entregar a tu institución.  

---

## 🛠️ Superpoderes

- 🔫 **Disparo automático de PDFs**  
  Llena el formato de asistencia con tus datos como un pro.  

- 🕵️ **Identidad secreta configurable**  
  Tu boleta, nombre, carrera y horarios entran directo al sistema.  

- 🛑 **Hackeo de días inhábiles**  
  Carga un `.csv` con vacaciones y días feriados → la app los esquiva.
  
  Para cargar fechas especiales mediante archivo CSV, el formato debe ser:
  
  Columnas: fecha, tipo_fecha.
  
  fecha: en formato DD/MM/AAAA.
  
  tipo_fecha: puede ser valores como Día inhábil o Periodo vacacional.
  

  ```bash
  fecha,tipo_fecha
  12/09/2024,Día inhábil
  15/09/2024,Periodo vacacional
  ```

- ⏳ **Cálculo ninja de periodos**  
  Solo pones inicio y fin → el sistema genera los cortes mensuales.  

- 🎮 **Interfaz modo gamer**  
  Angular + vista previa para que no entregues nada chueco.  

---

## 🔧 Tecnología secreta del cuartel

- [Node.js](https://nodejs.org/) + npm → el combustible de la base  
- [Angular](https://angular.dev/) → el arma principal de la UI  
- [pdf-lib](https://pdf-lib.js.org/) → magia negra para PDF  
- [moment.js](https://momentjs.com/) → control maestro del tiempo  

---

## 🚀 Cómo ponerlo en marcha

### 1️⃣ Clona la base de operaciones (Repositorio)
```bash
git clone https://github.com/Mik318/reportes-ss-generator.git
cd reportes-ss-generator

```
### 2️⃣ Instala el arsenal (Dependencias)
```bash
npm install
```
### 3️⃣ Activa la misión (Inicia la aplicacion)
```bash
npm start
```
### 4️⃣ Accede al cuartel secreto (Navegador)
```text
http://localhost:4200/
```
### Estructura del proyecto
```bash
reportes-ss-generator/
├── src/
│   ├── app/
│   │   ├── pages/configuracion/   # Lógica y vista principal para generar reportes
│   │   ├── shared/                # Componentes y servicios reutilizables
│   ├── assets/                    # Archivos estáticos (ej. plantillas PDF base)
│   │   └── control-asistencia.pdf
```

#### 🤝 Únete a la Resistencia

¿Detectaste un bug? 🐛
¿Tienes un gadget nuevo para la misión? ⚡

Abre un issue en la base de datos 🗃️

Lanza tu pull request y conviértete en héroe 🦸

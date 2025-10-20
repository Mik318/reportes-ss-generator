export const PDF_COORDINATES = {
  page1: {
    startDay: { x: 67, y: 614, size: 15 },
    startMonth: { x: 127, y: 614, size: 15 },
    startYear: { x: 189, y: 614, size: 15 },
    endDay: { x: 373, y: 614, size: 15 },
    endMonth: { x: 435, y: 614, size: 15 },
    endYear: { x: 495, y: 614, size: 15 },
    studentName: { x: 175, y: 550 },
    boleta: { x: 175, y: 505 },
    carrera: { x: 175, y: 476 },
    email: { x: 175, y: 448 },
    nombreResponsable: { x: 90, y: 287 }, // for length -> 15 130, for length 20 -> 120 for lenght for more than 25 let's put 90
    puestoResponsable: { x: 350, y: 287 }, // 320
    fechaEntrega: { x: 315, y: 245 },
  },
  page2: {
    studentName: { x: 150, y: 653, size: 10 },
    month: { x: 280, y: 637, size: 10 },
    totalHoras: { x: 362, y: 216, size: 10 },
    totalHorasAcumuladas: { x: 362, y: 201, size: 10 },
    table: {
      startY: 579.5,
      rowStep: 14.5,
      fontSize: 10,
      columns: {
        fecha: { x: 100 },
        horaEntrada: { x: 192 },
        horaSalida: { x: 277 },
        horasPorDia: { x: 365 },
      },
    },
  },
};

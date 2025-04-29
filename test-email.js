const nodemailer = require('nodemailer');

let transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: 'fede31d@gmail.com',
    pass: 'ppuzjgtesbqyuudq'
  }
});

transporter.sendMail({
  from: '"Test Email" <tua-email@gmail.com>',
  to: 'fede31d@gmail.com',
  subject: 'Test Email',
  text: 'Questa è una email di test!',
}).then(info => {
  console.log('Email inviata:', info.messageId);
}).catch(console.error);

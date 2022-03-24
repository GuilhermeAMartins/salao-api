const mongoose = require('mongoose');
const URI = 
    'mongodb+srv://Admin:AdminAdmin@cluster0.xnmye.mongodb.net/salao-na-mao?retryWrites=true&w=majority';

//mongoose.set('useNewUrlParser', true);
//mongoose.set('useFindAndModify', false);
//mongoose.set('useCreateIndex', true);
//mongoose.set('useUnifiedTopology', true);


mongoose
    .connect(URI)
    .then(() => console.log(`DB is up`))
    .catch(() => console.log(err));
const mongoose = require('mongoose');
const { modelName } = require('./salao');
const Schema = mongoose.Schema;

const arquivo = new Schema({
    referenciaId:{
        type: Schema.Types.ObjectId,
        refPath: 'Model ',
        required: true,
    },
    model:{
        type: String,
        require: true,
        enum: ['Servico', 'Salao'],
    },
    caminho : {
        type: String,
        require : true,
    },
    dataCadastro: {
        type: Date,
        default: Date.now,
    },
});

module.exports = mongoose.model('Arquivo',arquivo);
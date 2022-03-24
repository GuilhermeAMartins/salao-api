const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const servico = new Schema({
    salaoId: {
        type: mongoose.Types.ObjectId,
        ref: 'Salao',
        required: true,
    },
    titulo: {
        type: String,
        required: true,
    },
    preco: {
        type: Number,
        required: true,
    },
    comissao: {
        type: Number, // % de comissão sobre preço
        required: true,
    },
    duracao: {
        type: Date, 
        required: true,
        value: null,
    },
    recorrencia: { 
        type: Number, // Periodo ate o cliente precisar re-fazer o serviço em dias
        required: true,
    },
    descricao: {
        type: String,
        required: true,
    },
    status: {
        type: String,
        enum: ['A', 'I', 'E'],
        required: true,
        default: 'A',
   },
    dataCadastro: {
        type: Date,
        default: Date.now,
    },
});


module.exports = mongoose.model('Servico',servico);
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const salao = new Schema({
    nome: {
        type: String,
        required: true,
    },
    foto: {
        type: String,
    },
    capa: {
        type: String,
    },
    email: {
        type: String,
        required: true,
    },
    senha: {
        type: String,
        default: null,
    },
    telefone: {
        type: String,
        required: true,
    },
    endereco: { 
        cidade: String,
        uf: String,
        cep: String,
        numero: String,
        pais: String,
    },
    geo: {
        coordinates: Array,
    },
    recipientId: {
        type: String,
    },
    dataCadastro: {
        type: Date,
        default: Date.now,
    },
});

salao.index({ geo: '2dsphere'});

module.exports = mongoose.model('Salao',salao);
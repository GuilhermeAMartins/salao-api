const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const pagarme = require('../services/pagarme');
const Cliente = require('../models/cliente');
const SalaoCliente= require('../models/relationship/salaoClientes');


router.post('/', async(req,res) => {
    const db = mongoose.connection;
    const session = await db.startSession();
    session.startTransaction();

    try {    
        const { cliente, salaoId} = req.body;
        let newCliente = null;

        // VERIFICAR SE CLIENTE EXISTE
        const existentCliente = await Cliente.findOne({
           $or :  [
               {email: cliente.email},{telefone: cliente.telefone},
            ]
        });

        // SE CLIENTE NÃO EXISTIR
        if(!existentCliente){

            const _id = mongoose.Types.ObjectId();

            // CRIAR CUSTOMER
            const pagarmeCustomer = await pagarme('/customers',{
                external_id: _id,
                name: cliente.nome,
                type: cliente.documento.tipo == "cpf" ? "individual" : "corporation",
                country: cliente.endereco.pais,
                email: cliente.email,
                documents: [{
                    type: cliente.documento.tipo ,
                    number: cliente.documento.numero,
                }],
                phone_numbers: [cliente.telefone],
                birthday: cliente.dataNascimento,
            });
            if(pagarmeCustomer.error){
                throw pagarmeCustomer;
            }


            // CRIANDO CLIENTE
            newCliente = await Cliente({
                ...cliente,
                _id,
                customerId: pagarmeCustomer.data.id,
            }).save({ session });

        }

        // RELACIONAMENTO
        const clienteId =  existentCliente 
            ? existentCliente._id
            : newCliente._id;

        // VERIFICA SE JA EXISTE O RELACIONAMENTO COM O SALAO
        const existentRelationship = await SalaoCliente.findOne({
            salaoId,
            clienteId,
            status: { $ne: 'E'},
        });

        // SE NAO ESTA VINCULADO
        if(!existentRelationship){
            
            await new SalaoCliente({
                salaoId,
                clienteId,
            }).save({ session });
        }

        // SE JA EXISTIR O VINCULO ENTRE O CLIENTE E SALAO
        if(existentRelationship){

            const existentRelationship = await SalaoCliente.findOneAndUpdate({
                salaoId,
                clienteId,
                }, 
                { status: 'A'},
                { session }
            );
        }


        await session.commitTransaction();
        session.endSession();

        if(existentCliente && existentRelationship){
            res.json({ error: true, message: 'Cliente já cadastrado'});
        }else{
            res.json({ error: false});
        }

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        res.json({ error : true, message : error.message});
    }

});

router.post('/filter', async(req, res) => {
    try {

        const clientes = await Cliente.find(req.body.filters);
        res.json({ error : false, clientes});
        
    } catch (error) {
        res.json({ error : true , message : error});
    }
});

router.get('/salao/:salaoId', async(req, res) =>{
    try {

        const { salaoId } = req.params;

        // RECUPERAR VINCULOS
        const clientes = await SalaoCliente.find({
            salaoId,
            status: { $ne : 'E'},
        })
        .populate('clienteId').select('clienteId dataCadastro');

        res.json({ error : false, 
            clientes: clientes.map((vinculo)=>({
                ...vinculo.clienteId._doc,
                vinculoId: vinculo._id,
                dataCadastro: vinculo.dataCadastro,
            })), 
        });
    } catch (error) {
        res.json({ error: true, message : error});
    }

});

router.delete('/vinculo/:id', async(req,res) =>{
    try {
        await SalaoCliente.findByIdAndUpdate(req.params.id,{ status : 'E'});
        res.json({ error : false });
    } catch (error) {
        res.json({ error : true , message : error});
    }
});

module.exports = router;
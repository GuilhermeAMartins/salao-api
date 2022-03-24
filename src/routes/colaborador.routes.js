const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const pagarme = require('../services/pagarme');
const Colaborador = require('../models/colaborador');
const SalaoColaborador = require('../models/relationship/salaoColaborador');
const ColaboradorServico = require('../models/relationship/colaboradorServico');

router.post('/', async(req,res) => {
    const db = mongoose.connection;
    const session = await db.startSession();
    session.startTransaction();

    try {    
        const { colaborador, salaoId} = req.body;
        let newColaborador = null;

        // VERIFICAR SE COLABORADOR EXISTE
        const existentColaborador = await Colaborador.findOne({
           $or :  [
               {email: colaborador.email},{telefone: colaborador.telefone},
            ]
        });

        // SE COLABORADOR NÃO EXISTIR
        if(!existentColaborador){

            // CRIAR CONTA BANCARIA
            const { contaBancaria } = colaborador;
            const pagarmeBankAccount = await pagarme('bank_accounts',{
                agencia: contaBancaria.agencia,
                bank_code: contaBancaria.banco,
                conta: contaBancaria.numero,
                conta_dv: contaBancaria.dv,
                type: contaBancaria.tipo,
                document_number: contaBancaria.cpfCnpj,
                legal_name: contaBancaria.titular,
            });
            if(pagarmeBankAccount.error){
                throw pagarmeBankAccount;
            }


            // CRIAR RECEBEDOR
            const pagarmeRecipient = await pagarme('/recipients',{
                transfer_interval: 'daily',
                transfer_enable: true,
                bank_account_id: pagarmeBankAccount.data.id,
            });
            if(pagarmeRecipient.error){
                throw pagarmeRecipient;
            }


            // CRIANDO COLABORADOR
            newColaborador = await Colaborador({
                ...colaborador,
                recipientId: pagarmeRecipient.data.id,
            }).save({ session });

        }

        // RELACIONAMENTO
        const colaboradorId =  existentColaborador 
            ? existentColaborador._id
            : newColaborador._id;

        // VERIFICA SE JA EXISTE O RELACIONAMENTO COM O SALAO
        const existentRelationship = await SalaoColaborador.findOne({
            salaoId,
            colaboradorId,
            status: { $ne: 'E'},
        });

        // SE NAO ESTA VINCULADO
        if(!existentRelationship){
            
            await new SalaoColaborador({
                salaoId,
                colaboradorId,
                status: colaborador.vinculo,
            }).save({ session });
        }

        // SE JA EXISTIR O VINCULO ENTRE O COLABORADOR E SALAO
        if(existentRelationship){

            const existentRelationship = await SalaoColaborador.findOneAndUpdate({
                salaoId,
                colaboradorId,
                }, 
                { status: colaborador.vinculo },
                { session }
            );
        }

        // RELACAO COM AS ESPECIALIDADES
        await ColaboradorServico.insertMany(
            colaborador.especialidades.map( servicoId => ({
                servicoId,
                colaboradorId,
                }), 
                { session }
            )
        );

        await session.commitTransaction();
        session.endSession();

        if(existentColaborador && existentRelationship){
            res.json({ error: true, message: 'Colaborador já cadastrado'});
        }else{
            res.json({ error: false});
        }

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        res.json({ error : true, message : error.message});
    }

});

router.put('/:colaboradorId', async(req,res) => {
    try {
        const { vinculo ,  vinculoId , especialidades } =req.body;
        const { colaboradorId } = req.params;

        //VINCULO
        await SalaoColaborador.findByIdAndUpdate(vinculoId, {status: vinculo});

        //ESPECIALIDADES
        await ColaboradorServico.deleteMany({
            colaboradorId,
        });

        if(especialidades === null){

        }else{
            await ColaboradorServico.insertMany(
                especialidades.map(
                    (servicoId) => ({
                        servicoId,
                        colaboradorId,
                }))
        );
        }

        res.json({ error : false});

    } catch (error) {
        res.json({ error : true, message : error.message});
    }
});

router.delete('/vinculo/:id', async(req,res) =>{
    try {
        await SalaoColaborador.findByIdAndUpdate(req.params.id,{ status : 'E'});
        res.json({ error : false });
    } catch (error) {
        res.json({ error : true , message : error});
    }
});

router.post('/filter', async(req, res) => {
    try {
       const colaboradores = await Colaborador.find(req.body.filters);
       res.json({ error : false, colaboradores});
    } catch (error) {
        res.json({ error : true , message : error});
    }
});

router.get('/salao/:salaoId', async(req, res) =>{
    try {

        const { salaoId } = req.params;
        let colaboradores = [];
        
        // RECUPERAR VINCULOS
        const salaoColaboradores = await SalaoColaborador.find({
            salaoId,
            status: { $ne : 'E'},
        })
        .populate({ path: 'colaboradorId', select: '-senha'})
        .select('colaboradorId dataCadastro status');
        
        for ( let vinculo of salaoColaboradores ){
            const especialidades = await ColaboradorServico.find({
                colaboradorId: vinculo.colaboradorId._id,
            });
            colaboradores.push({
                ...vinculo._doc,
                vinculoId: vinculo._id,
                vinculo: vinculo.status,
                especialidades: especialidades.map((especialidade)=>especialidade.servicoId),
            });
        }
        res.json({ error : false, colaboradores});
    } catch (error) {
        res.json({ error: true, message : error.message});
    }

});


module.exports = router;
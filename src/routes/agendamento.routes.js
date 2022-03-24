const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const pagarme = require('../services/pagarme');
const moment = require('moment');
const _ = require('lodash');

const Cliente = require('../models/cliente');
const Salao = require('../models/salao');
const Servico = require('../models/servico');
const Colaborador = require('../models/colaborador');
const util = require('../util');
const keys = require('../data/keys.json');
const Agendamento = require('../models/agendamento');
const Horario = require('../models/horario');
const agendamento = require('../models/agendamento');


router.post('/', async(req,res)=>{
    const db = mongoose.connection;
    const session = await db.startSession();
    session.startTransaction();

    try {
        const { clienteId, salaoId, servicoId, colaboradorId , data } =req.body;

        //FAZER VERIFICAÇÃO SE O HORARIO AINDA ESTA DISPONIVEL
        /* 
            FAZER COM QUE O AGENDAMENTO SEJA DINAMICO 
        */
        const tempo= await Agendamento.findOne({data});
        if(tempo){
            throw{message: "Horario ja agendado"}
        }

        //PEGANDO O CLIENTE
        const cliente = await Cliente.findById(clienteId).select('nome endereco customerId');

        //PEGANDO O SALAO
        const salao = await Salao.findById(salaoId).select('recipientId');

        //PEGANDO O SERVICO
        const servico = await Servico.findById(servicoId).select('preco titulo comissao');

        //PEGANDO O COLABORADOR
        const colaborador = await Colaborador.findById(colaboradorId).select('recipientId');
        
        //CRIAR PAGAMENTO
        const precoFinal = util.toCents(servico.preco) * 100;
        
        //COLABORADOR SPLIT RULES
        const colaboradorSplitRule = {
            recipient_id: colaborador.recipientId,
            amount: parseInt(precoFinal * (servico.comissao / 100)), 
        };

        const createPayment = await pagarme('/transactions', {
            
            //PREÇÇO TOTAL
            amount: precoFinal,

            //DADOS DO CARTÃO
            card_number: '4111111111111111',
            card_cvv: '123',
            card_expiration_date: '0922',
            card_holder_name: "Morpheus Fishburne",

            //DADOS DO CLIENTE
            customer: {
                id: cliente.customerId
            },

            //DAODS DE ENDEREÇO DE CLIENTE
            billing: {
                name: cliente.nome,
                address: {
                    country: cliente.endereco.pais,
                    state: cliente.endereco.uf,
                    city: cliente.endereco.cidade,
                    street: cliente.endereco.logradouro,
                    street_number: cliente.endereco.numero,
                    zipcode: cliente.endereco.cep,
                },
            },

            //ITEM DA VENDA
            items: [{
                id: servicoId,
                title: servico.titulo,
                unit_price: precoFinal,
                quantity: 1,
                tangible: false
            }],
            split_rules: [
                //TAXA DO SALAO
                {
                    recipient_id: salao.recipientId,
                    amount: precoFinal - keys.app_fee - colaboradorSplitRule.amount,
                },
                //TAXA DO COLABORADOR
                colaboradorSplitRule,
                //TAXA DO APLICATIVO
                {
                    recipient_id: keys.recipientId,
                    amount: keys.app_fee,
                },
            ],
        });

        if(createPayment.error){
            throw createPayment;
        }

        //CRIAR AGENDAMENTO
        const agendamento = await new Agendamento({
            ...req.body,
            transactionId: createPayment.data.id,
            comissao : servico.comissao,
            valor: servico.preco,
        }).save({ session });

        await session.commitTransaction();
        session.endSession();
        res.json({ error : false, agendamento });

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        res.json({ error: true , message : error.message});   
    }

});

router.post('/filter', async(req,res)=>{
    try {
        
        const { periodo, salaoId} = req.body;

        const agendamentos = await Agendamento.find({
            salaoId,
            data: {
                $gte: moment(periodo.inicio).startOf('day'),
                $lte: moment(periodo.final).endOf('day'),
            },
        }).populate([
            { path : 'servicoId' , select : 'titulo duracao' },
            { path : 'colaboradorId' , select : 'nome ' },
            { path : 'clienteId' , select : 'nome ' },
        ]);

        res.json({ error: false, agendamentos});
    
    } catch (error) {
        res.json({ error: true, message: error.message});
    }
});

router.post('/dias-disponiveis', async(req,res)=>{
    try {
        const { data, salaoId, servicoId } = req.body;
        const horarios = await Horario.find({ salaoId });
        const servico = await Servico.findById(servicoId).select('duracao');

        let agenda = [];
        let colaboradores = [];
        let lastDay = moment(data);

        //DURACAO DO SERVICO
        const servicoMinutos = util.hourToMinutes(moment(servico.duracao).format('HH:mm'));

        const servicoSlots = util.sliceMinutes(
            servico.duracao,
            moment(servico.duracao).add(servicoMinutos, 'minutes'),
            util.SLOT_DURATION,
        ).length;

        for( let i = 0 ; i <= 365 && agenda.length <= 7; i++ ){
            const espacosValidor = horarios.filter(horario =>{
                //VERIFICAR DIA DISPONIVEL
                const diaSemadaDisponivel = horario.dias.includes(moment(lastDay).day());

                //VERIFICAR ESPECIALIDADE DISPONIVEL
                const servicoDisponivel = horario.especialidades.includes(servicoId);

                return diaSemadaDisponivel && servicoDisponivel;
            });

            //TODOS OS COLABORADORES DISPONIVEIS NO DIA E SEUS HORARIOS
            
            

            if( espacosValidor.length > 0 ){

                let todosHorariosDia = {}

                for( let espaco of espacosValidor){
                    for(let colaboradorId of espaco.colaboradores){
                        if(!todosHorariosDia[colaboradorId]){
                            todosHorariosDia[colaboradorId] = [];
                        }
                        //PEGAS TODOS OS HORARIO DO ESPACO E JOGAR PARA DENTRO DO COLABORADOR
                        todosHorariosDia[colaboradorId] = [
                            ...todosHorariosDia[colaboradorId],
                            ...util.sliceMinutes(
                                util.mergeDataTime(lastDay, espaco.inicio),
                                util.mergeDataTime(lastDay, espaco.fim),
                                util.SLOT_DURATION
                            )
                        ];
                    }
                }

                // OCUPACAO DE CADA ESPECIALISTA NO DIA
                for( let colaboradorId of Object.keys(todosHorariosDia)){
                    //PEGAR AGENDAMENTO
                    const agendamentos = await Agendamento.find({
                        colaboradorId,
                        data: {
                            $gte: lastDay.startOf('day'),
                            $lte: moment(lastDay).endOf('day'),
                        },
                    })
                    .select('data servicoId -_id')
                    .populate('servicoId','duracao');

                    //PEGANDO HORARIOS AGENDADOS
                    let horariosOcupados = agendamentos.map((agendamento) => ({
                        inicio: moment(agendamento.data),
                        final: moment(agendamento.data).add(
                            moment(servico.duracao).format('HH:mm')
                        ),
                    }));
                    
                    //PEGAR TODOS OS HORARIOS OCUPADOS
                    horariosOcupados = horariosOcupados.map((horario) => 
                        util.sliceMinutes(horario.inicio, horario.final, util.SLOT_DURATION)
                    ).flat();

                    //REMOVENDO TODOS SOS HORARIOS OCUPADOS
                    let horariosLivres = util.slpitByValue(
                        todosHorariosDia[colaboradorId].map(horarioLivre =>{
                        return horariosOcupados.includes(horarioLivre) ? '-' : horarioLivre;
                        }),
                        '-'
                    ).filter(space => space.length > 0);

                    //VERIFICANDO SE EXISTE ESPAÇO SUFICIENTE NO SLOT
                    horariosLivres = horariosLivres.filter((horarios) =>
                        horarios.length >= servicoSlots
                    );
                    
                    //VERIFICANDO SE O HORARIO DENTRO DO SLOT TEM A QUANTIDADE NECESSARIA
                    horariosLivres = horariosLivres.map((slot) =>
                        slot.filter((horario, index) => slot.length - index >= servicoSlots
                    )).flat();
 
                    //FORAMATANDO HORARIO DE 2 EM 2
                    horariosLivres = _.chunk(horariosLivres, 2)

                    //REMOVER COLABORADOR CASO NAO TENHA NEM UM ESPACO
                    if(horariosLivres.length == 0 ){
                        todosHorariosDia = _.omit(todosHorariosDia, colaboradorId);
                    }else{
                        todosHorariosDia[colaboradorId] = horariosLivres;
                    }
                }

                //VERIFICAR SE TEM ESPECIALISTA DISPONIVEL NAQUELE DIA
                const totalEspecialistas = Object.keys(todosHorariosDia).length;

                if(totalEspecialistas > 0){
                    colaboradores.push(Object.keys(todosHorariosDia));
                    agenda.push({
                        [lastDay.format('YYYY-MM-DD')] : todosHorariosDia,
                    })
                }
            };
            lastDay = lastDay.add(1, 'day');
        };
    
        //PEGANDO DADOS DOS COLABORADORES
        colaboradores = _.uniq(colaboradores.flat());

        colaboradores = await Colaborador.find({
            _id: { $in: colaboradores},
        }).select('nome foto');

        colaboradores = colaboradores.map(c =>({
            ...c._doc,
            nome: c.nome.split(' ')[0],
        }));


        res.json({ error : false , colaboradores , agenda});
    } catch (error) {
        res.json({ error : true , message : error.message });
    }
});

module.exports = router;    

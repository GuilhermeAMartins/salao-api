const express = require('express');
const router = express.Router();
const Salao = require('../models/salao');
const Servico = require('../models/servico');
const turf = require('@turf/turf');

router.post('/', async (req, res) =>{
    try {
        const salao = await new Salao(req.body).save();
        res.json({ salao });
    } catch (err) {
        res.json({ error : true , message: err.message})
    }
});

router.get('/servicos/:salaoId', async(req, res) =>{
    try {
        const { salaiId } = req.params;
        const servicos = await Servico.find({
            salaiId,
            status: 'A'
        }).select('_id titulo');

        /* [{ label: 'Serviço' , value : '12312313' }]*/ 
        res.json({ 
            servicos:  servicos.map(s => ({ label: s.titulo , value: s._id }))
        });

        } catch (error) {
        res.json({ error : true , message: error.message})
    }
});

router.get('/:id',  async (req, res) =>{
    try {
        const salao = await Salao.findById(req.params.id).select(
        'capa nome endereco.cidade geo.coordinates telefone'
        );
        
        // DISTANCIA
        const distance = turf.distance(
            turf.point(salao.geo.coordinates),
            turf.point([-30.043858, -51.103487])            
        );  

        res.json({ error : false, salao ,distance });

    } catch (error) {
        res.json({ error: true, message : error.message});
    }
});

module.exports = router;
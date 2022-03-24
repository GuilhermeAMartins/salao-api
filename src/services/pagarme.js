const axios = require('axios');
const api_key = require('../data/keys.json').api_key;

const api = axios.create({
    baseURL: 'https://api.pagar.me/1/',
}); 


module.exports = async ( endpoint, data, method = 'post') =>{
    try {
        const response = await api[method](endpoint,{
            api_key,
            ...data,
        });

        return { error : false , data: response.data};
    } catch (error) {
        return{
            error: true,
            message: JSON.stringify(error.response.data.errors[0]),
        };
    }

    /*    return await api[method]( endpoint, {
            api_key,
            ...data,  
        }).then(res =>{
            return { error: false, data: res.data.data}
        }).catch(err =>{
            console.log(err.response.data);
            return {
                error : true,
                message: err.response.data.message || "error",
            };
        });
    */
};


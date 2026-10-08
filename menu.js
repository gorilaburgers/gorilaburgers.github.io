/* Carta de Gorila Burgers (generado desde clientes/gorila-burgers/cliente.json). Precios en centavos. desc = null → ingredientes sin confirmar. */
window.MENU = {
  "categorias": [
    {
      "id": "vip",
      "antes": "Hamburguesas",
      "nombre": "VIP",
      "extras": true,
      "items": [
        {
          "id": "texas",
          "nombre": "Gorila Texas + papas",
          "precio": 790,
          "lema": "La campeona que domina",
          "desc": "2 carnes, 2 quesos cheddar, tocino, cebollas empanizadas, salsa BBQ y salsa Kong"
        },
        {
          "id": "superguesa",
          "nombre": "SuperGuesa + papas",
          "precio": 790,
          "lema": "Nivel bestia activado",
          "desc": null
        },
        {
          "id": "jam",
          "nombre": "Jam Smash",
          "precio": 499,
          "lema": "La que cambia el juego",
          "desc": "2 carnes smash, 2 quesos cheddar, cebollas caramelizadas y salsa smash",
          "confirmar": "¿Incluye papas y bebida? ¿Salsa smash o salsa Jam?"
        }
      ]
    },
    {
      "id": "especiales",
      "antes": "Hamburguesas",
      "nombre": "Especiales",
      "extras": true,
      "items": [
        {
          "id": "hawayana",
          "nombre": "Hawayana + papas",
          "precio": 590,
          "lema": "Dulce, atrevida y peligrosa",
          "desc": null
        },
        {
          "id": "tocino",
          "nombre": "Tocino BBQ + papas",
          "precio": 590,
          "lema": "Puro fuego en cada mordida",
          "desc": "Carne, queso cheddar, tocino, salsa BBQ, salsa Kong y vegetales"
        }
      ]
    },
    {
      "id": "peques",
      "antes": "Menú para",
      "nombre": "Peques",
      "extras": true,
      "items": [
        {
          "id": "cheese",
          "nombre": "Cheese Burger + papas",
          "precio": 550,
          "lema": "El clásico que nunca falla",
          "desc": "Carne, queso cheddar, salsa Kong y vegetales"
        },
        {
          "id": "mini",
          "nombre": "Mini Gorila + papas",
          "precio": 490,
          "lema": "Pequeña pero con carácter",
          "desc": "Carne, salsa Kong y vegetales"
        }
      ]
    },
    {
      "id": "papas",
      "antes": "Para acompañar",
      "nombre": "Papas",
      "extras": false,
      "items": [
        {
          "id": "cbfries",
          "nombre": "Cheese Bacon Fries",
          "precio": 450,
          "lema": null,
          "desc": null
        },
        {
          "id": "papas",
          "antes": "Para acompañar",
          "nombre": "Papas",
          "precio": 150,
          "lema": null,
          "desc": null
        }
      ]
    },
    {
      "id": "bebidas",
      "antes": "Para tomar",
      "nombre": "Bebidas",
      "extras": false,
      "items": [
        {
          "id": "lemonsun",
          "nombre": "Lemon Sun",
          "precio": 190,
          "lema": null,
          "desc": null
        },
        {
          "id": "redlemon",
          "nombre": "Red Lemon",
          "precio": 190,
          "lema": null,
          "desc": null
        },
        {
          "id": "cerveza",
          "nombre": "Cerveza de Gorila",
          "precio": 450,
          "lema": null,
          "desc": null
        }
      ]
    }
  ],
  "extras": [
    {
      "id": "x-carne",
      "nombre": "Carne",
      "precio": 200
    },
    {
      "id": "x-queso",
      "nombre": "Queso",
      "precio": 100
    },
    {
      "id": "x-tocino",
      "nombre": "Tocino",
      "precio": 150
    },
    {
      "id": "x-crunch",
      "nombre": "Tocino crunch",
      "precio": 150
    },
    {
      "id": "x-pina",
      "nombre": "Piña",
      "precio": 150
    },
    {
      "id": "x-kong",
      "nombre": "Salsa Kong",
      "precio": 100
    },
    {
      "id": "x-caram",
      "nombre": "Cebollas caramelizadas",
      "precio": 100
    },
    {
      "id": "x-empan",
      "nombre": "Cebollas empanizadas",
      "precio": 100
    }
  ],
  "temporada": {
    "nombre": "Molotov",
    "nota": "Hamburguesa de temporada",
    "precio": null,
    "foto": "assets/molotov-mesa.webp",
    "confirmar": "Era \"disponible hasta junio\": ¿sigue en carta y a qué precio?",
    "alt": "Hamburguesa Molotov: carne desmechada, queso fundido y brocheta de tocino con jalapeño",
    "fotoW": 468,
    "fotoH": 508
  }
};

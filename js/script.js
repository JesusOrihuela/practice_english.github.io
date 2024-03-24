document.addEventListener('DOMContentLoaded', function() {
    var lista1 = localStorage.getItem('lista1');
    var lista2 = localStorage.getItem('lista2');
    
    // Definir las listas de frases y categorías dentro de un objeto
    var listas = {
        'DailyLife_phrases': [
            "I feel happy today",
            "She's studying at the library",
            "The keys are on the table",
            "We're going to the park",
            "He lives in New York City",
            "They're watching TV in the living room",
            "The book is under the bed",
            "She's cooking in the kitchen",
            "We're meeting at the cafe",
            "He's working in the office",
            "The cat is hiding behind the couch",
            "I'm feeling tired after work",
            "The restaurant is next to the movie theater",
            "She's waiting for the bus at the bus stop",
            "They're playing in the backyard",
            "We're having dinner at the dining table",
            "He's sleeping in the bedroom",
            "The shoes are in the closet",
            "We're going for a walk in the neighborhood",
            "She's studying at the desk",
            "I'm feeling excited about the trip",
            "The supermarket is across the street",
            "He's sitting on the couch",
            "They're painting the walls in the living room",
            "We're having a party in the garden",
            "She's reading in the armchair",
            "I'm feeling nervous before the presentation",
            "The movie theater is on Main Street",
            "He's standing by the window",
            "They're playing games in the basement",
            "We're having breakfast at the kitchen counter",
            "She's chatting on the phone in the hallway",
            "I'm feeling bored at home",
            "The museum is downtown",
            "He's relaxing on the balcony",
            "They're studying in the study room",
            "We're eating snacks on the couch",
            "She's taking a shower in the bathroom",
            "I'm feeling lonely without my friends",
            "The post office is near the bank",
            "He's exercising in the gym",
            "They're laughing in the backyard",
            "We're having a barbecue in the backyard",
            "She's getting dressed in the bedroom",
            "I'm feeling hungry, let's eat something",
            "The pharmacy is on the corner",
            "He's listening to music in the bedroom",
            "They're playing music in the living room",
            "We're having a picnic at the park",
            "She's watering the plants in the garden"
        ],
        'DailyLife_traductions': [
            "Hoy me siento feliz",
            "Ella está estudiando en la biblioteca",
            "Las llaves están sobre la mesa",
            "Vamos al parque",
            "Él vive en Nueva York",
            "Están viendo la tele en el salón",
            "El libro está debajo de la cama",
            "Ella está cocinando en la cocina",
            "Hemos quedado en la cafetería",
            "Está trabajando en la oficina",
            "El gato se esconde detrás del sofá",
            "Me siento cansado después del trabajo",
            "El restaurante está al lado del cine",
            "Está esperando el autobús en la parada",
            "Están jugando en el patio trasero",
            "Estamos cenando en la mesa del comedor",
            "Está durmiendo en el dormitorio",
            "Los zapatos están en el armario",
            "Vamos a dar un paseo por el barrio",
            "Está estudiando en el escritorio",
            "Estoy emocionado por el viaje",
            "El supermercado está cruzando la calle",
            "Está sentado en el sofá",
            "Están pintando las paredes del salón",
            "Estamos celebrando una fiesta en el jardín",
            "Está leyendo en el sillón",
            "Estoy nervioso antes de la presentación",
            "El cine está en la calle principal",
            "Está junto a la ventana",
            "Están jugando en el sótano",
            "Estamos desayunando en el mostrador de la cocina",
            "Está hablando por teléfono en el pasillo",
            "Me aburro en casa",
            "El museo está en el centro",
            "Se está relajando en el balcón",
            "Están estudiando en la sala de estudio",
            "Estamos comiendo bocadillos en el sofá",
            "Se está duchando en el baño",
            "Me siento solo sin mis amigos",
            "La oficina de correos está cerca del banco",
            "Está haciendo ejercicio en el gimnasio",
            "Se están riendo en el patio trasero",
            "Estamos haciendo una barbacoa en el patio trasero",
            "Se está vistiendo en el dormitorio",
            "Tengo hambre, vamos a comer algo",
            "La farmacia está en la esquina",
            "Está escuchando música en el dormitorio",
            "Están poniendo música en el salón",
            "Estamos haciendo un picnic en el parque",
            "Ella está regando las plantas en el jardín"
        ],
        'Accountability_phrases': [ 
            "Let's start the meeting",
            "I've reviewed the financial reports",
            "We need to adjust the budget",
            "The sales figures are up",
            "We're facing a cash flow issue",
            "We need to audit the accounts",
            "The tax returns are due",
            "We're looking for a new accounting software",
            "The inventory needs to be updated",
            "We have a new client",
            "We're closing the fiscal year",
            "We need to reconcile the bank accounts",
            "The payroll is due",
            "We're preparing the financial statements",
            "We're auditing the expenses",
            "The tax audit is scheduled",
            "We're updating the financial models",
            "We're reviewing the contracts",
            "We're preparing for the annual audit",
            "We're finalizing the financial forecast",
            "We're analyzing the market trends",
            "We're setting up the new fiscal year",
            "We're closing the books for the quarter",
            "We're reviewing the financial performance",
            "We're preparing for the annual meeting",
            "We're updating the financial records",
            "We're auditing the financial transactions",
            "We're preparing the tax filings",
            "We're reviewing the financial policies",
            "We're updating the financial reports",
            "We're preparing for the annual budget review",
            "We're analyzing the financial risks",
            "We're setting up the new fiscal year budget",
            "We're reviewing the financial forecast",
            "We're preparing for the annual tax planning",
            "We've set up the new fiscal year",
            "We've closed the books for the quarter",
            "We've reviewed the financial performance",
            "We've prepared for the annual meeting",
            "We've updated the financial records",
            "We've audited the financial transactions",
            "We've prepared the tax filings",
            "We've reviewed the financial policies",
            "We've updated the financial reports",
            "We've prepared for the annual budget review",
            "We've analyzed the financial risks",
            "We've set up the new fiscal year budget",
            "We've reviewed the financial forecast",
            "We've prepared for the annual tax planning",
            "We've updated the financial models",
            "We've reviewed the financial statements",
            "We've prepared for the annual audit",
            "We've finalized the financial forecast",
            "We've analyzed the market trends"
        ],
        'Accountability_traductions': [ 
            "Empecemos la reunión",
            "He revisado los informes financieros",
            "Necesitamos ajustar el presupuesto",
            "Las cifras de ventas han aumentado",
            "Estamos enfrentando un problema de flujo de efectivo",
            "Necesitamos auditar las cuentas",
            "Las declaraciones de impuestos están vencidas",
            "Estamos buscando un nuevo software de contabilidad",
            "El inventario necesita ser actualizado",
            "Tenemos un nuevo cliente",
            "Estamos cerrando el año fiscal",
            "Necesitamos conciliar las cuentas bancarias",
            "La nómina está vencida",
            "Estamos preparando los estados financieros",
            "Estamos auditando los gastos",
            "La auditoría fiscal está programada",
            "Estamos actualizando los modelos financieros",
            "Estamos revisando los contratos",
            "Estamos preparándonos para la auditoría anual",
            "Estamos finalizando el pronóstico financiero",
            "Estamos analizando las tendencias del mercado",
            "Estamos configurando el nuevo año fiscal",
            "Estamos cerrando los libros del trimestre",
            "Estamos revisando el rendimiento financiero",
            "Estamos preparándonos para la reunión anual",
            "Estamos actualizando los registros financieros",
            "Estamos auditando las transacciones financieras",
            "Estamos preparando las declaraciones de impuestos",
            "Estamos revisando las políticas financieras",
            "Estamos actualizando los informes financieros",
            "Estamos preparándonos para la revisión presupuestaria anual",
            "Estamos analizando los riesgos financieros",
            "Estamos configurando el presupuesto del nuevo año fiscal",
            "Estamos revisando el pronóstico financiero",
            "Estamos preparándonos para la planificación fiscal anual",
            "Hemos configurado el nuevo año fiscal",
            "Hemos cerrado los libros del trimestre",
            "Hemos revisado el rendimiento financiero",
            "Hemos preparado la reunión anual",
            "Hemos actualizado los registros financieros",
            "Hemos auditado las transacciones financieras",
            "Hemos preparado las declaraciones de impuestos",
            "Hemos revisado las políticas financieras",
            "Hemos actualizado los informes financieros",
            "Hemos preparado la revisión presupuestaria anual",
            "Hemos analizado los riesgos financieros",
            "Hemos configurado el presupuesto del nuevo año fiscal",
            "Hemos revisado el pronóstico financiero",
            "Hemos preparado la planificación fiscal anual",
            "Hemos actualizado los modelos financieros",
            "Hemos revisado los estados financieros",
            "Hemos preparado la auditoría anual",
            "Hemos finalizado el pronóstico financiero",
            "Hemos analizado las tendencias del mercado"
        ],
        'Gym_phrases': [ 
            "Can you show me how to properly use this machine?",
            "What's the correct form for this exercise?",
            "Could you spot me while I do this exercise?",
            "Is it okay if I use this bench after you?",
            "Could you help me adjust the settings on this machine?",
            "How many sets and reps should I do for this exercise?",
            "Could you demonstrate how to do a proper squat?",
            "Can you recommend a good weight for me to start with?",
            "Is there a specific warm-up routine I should follow?",
            "How do I adjust the seat height on this machine?",
            "Could you assist me in setting up the cable machine?",
            "Can you give me some tips on improving my form for this exercise?",
            "Do you have any recommendations for exercises targeting my lower back?",
            "Could you check my form and let me know if I'm doing this exercise correctly?",
            "Can you suggest some alternative exercises for targeting my chest muscles?",
            "Is it alright if I work in with you on this machine?",
            "Could you explain the benefits of using free weights over machines?",
            "What's the proper breathing technique for this exercise?",
            "Can you help me understand which muscle groups this machine targets?",
            "Do you have any suggestions for increasing the intensity of my workout?",
            "Is there a cooldown routine I should follow after my workout?",
            "How do I properly sanitize the equipment after using it?",
            "Could you recommend a good stretching routine for after my workout?",
            "Do you have any advice for preventing muscle imbalances?",
            "Can you show me how to adjust the resistance on this machine?",
            "What's the best way to incorporate this machine into my workout routine?",
            "Could you demonstrate how to use the foam roller for muscle recovery?",
            "Is there a specific order I should follow when using the machines?",
            "Do you have any tips for preventing injuries while lifting weights?",
            "Could you explain the difference between using machines and free weights?",
            "What's the correct posture for using this machine?",
            "Can you help me understand the correct grip for this exercise?",
            "Could you recommend some exercises to strengthen my core?",
            "Is there a cooldown routine I should follow after using the cardio machines?",
            "What's the proper way to use the rowing machine without straining my back?",
            "Can you suggest some exercises for targeting my hamstrings?",
            "What's the recommended rest time between sets for this exercise?",
            "Do you have any tips for improving my balance during this exercise?",
            "Could you demonstrate how to use the resistance bands for a full-body workout?",
            "Is it okay if I use this bench for my next set?",
            "What's the best way to track my progress and set fitness goals?",
            "Can you suggest some stretches to improve flexibility before my workout?",
            "What's the correct angle for adjusting the incline on this treadmill?"
        ],
        'Gym_traductions': [ 
            "¿Puedes mostrarme cómo usar correctamente esta máquina?",
            "¿Cuál es la forma correcta para este ejercicio?",
            "¿Podrías vigilarme mientras hago este ejercicio?",
            "¿Está bien si uso este banco después de ti?",
            "¿Podrías ayudarme a ajustar la configuración en esta máquina?",
            "¿Cuántas series y repeticiones debo hacer para este ejercicio?",
            "¿Podrías demostrarme cómo hacer una sentadilla correctamente?",
            "¿Puedes recomendarme un peso adecuado para empezar?",
            "¿Hay una rutina específica de calentamiento que debería seguir?",
            "¿Cómo ajusto la altura del asiento en esta máquina?",
            "¿Podrías ayudarme a configurar la máquina de poleas?",
            "¿Puedes darme algunos consejos para mejorar mi técnica en este ejercicio?",
            "¿Tienes alguna recomendación de ejercicios para fortalecer mi espalda baja?",
            "¿Podrías verificar mi postura y decirme si estoy haciendo este ejercicio correctamente?",
            "¿Puedes sugerirme algunos ejercicios alternativos para trabajar los músculos pectorales?",
            "¿Está bien si trabajo con esta máquina después de ti?",
            "¿Podrías explicarme los beneficios de usar pesas libres en lugar de máquinas?",
            "¿Cuál es la técnica de respiración adecuada para este ejercicio?",
            "¿Me puedes ayudar a entender qué grupos musculares se trabajan en esta máquina?",
            "¿Tienes alguna sugerencia para aumentar la intensidad de mi entrenamiento?",
            "¿Debería seguir algún tipo de rutina de enfriamiento después de mi entrenamiento?",
            "¿Cómo desinfecto correctamente el equipo después de usarlo?",
            "¿Podrías recomendarme una rutina de estiramientos para después del entrenamiento?",
            "¿Tienes algún consejo para prevenir desequilibrios musculares?",
            "¿Puedes mostrarme cómo ajustar la resistencia en esta máquina?",
            "¿Cuál es la mejor manera de incorporar esta máquina en mi rutina de entrenamiento?",
            "¿Podrías demostrarme cómo usar el rodillo de espuma para recuperación muscular?",
            "¿Hay un orden específico que debería seguir al usar las máquinas?",
            "¿Tienes algunos consejos para prevenir lesiones al levantar pesas?",
            "¿Podrías explicarme la diferencia entre usar máquinas y pesas libres?",
            "¿Cuál es la postura correcta para usar esta máquina?",
            "¿Puedes ayudarme a entender el agarre correcto para este ejercicio?",
            "¿Podrías recomendarme algunos ejercicios para fortalecer mi core?",
            "¿Debería seguir alguna rutina de enfriamiento después de usar las máquinas de cardio?",
            "¿Cuál es la manera adecuada de usar la máquina de remo sin lastimar mi espalda?",
            "¿Puedes sugerirme algunos ejercicios para trabajar los músculos isquiotibiales?",
            "¿Cuánto tiempo de descanso recomiendas entre series para este ejercicio?",
            "¿Tienes algunos consejos para mejorar mi equilibrio durante este ejercicio?",
            "¿Podrías demostrarme cómo usar las bandas de resistencia para un entrenamiento de cuerpo completo?",
            "¿Está bien si uso este banco para mi próxima serie?",
            "¿Cuál es la mejor manera de hacer un seguimiento de mi progreso y establecer metas de fitness?",
            "¿Puedes sugerirme algunos estiramientos para mejorar la flexibilidad antes de mi entrenamiento?",
            "¿Cuál es el ángulo correcto para ajustar la inclinación en esta cinta de correr?"
        ],
        'Restaurant_phrases': [ 
            "Can we see the menu, please?",
            "Do you have any vegetarian options?",
            "What do you recommend as a specialty of the house?",
            "Could you tell me about today's specials?",
            "Is this dish spicy?",
            "Could I have this dish without onions, please?",
            "Do you offer gluten-free alternatives?",
            "How long will the food take to arrive?",
            "Could I have a glass of water, please?",
            "Is it possible to split the bill?",
            "Do you have any desserts available?",
            "Could I have some extra napkins, please?",
            "Is the tip included in the bill?",
            "Can I get a refill on my drink?",
            "Do you have any recommendations for wine pairings?",
            "Do you offer any children's menus?",
            "Could I have some bread while we wait?",
            "Is there a minimum order for delivery?",
            "Can I make a reservation for two for tonight?",
            "Could I have some more ice in my drink, please?",
            "Do you offer any discounts for large groups?",
            "Is there a corkage fee if I bring my own wine?",
            "Could I have my steak cooked medium, please?",
            "Is there a limit to the number of people for a reservation?",
            "Do you have any recommendations for appetizers?",
            "Could I have some extra sauce on the side?",
            "Is it possible to have my meal packed to go?",
            "Could you recommend a good wine within a reasonable price range?",
            "Do you have any outdoor seating available?",
            "Could I have the bill, please?",
            "Is there a happy hour special?",
            "Do you offer any low-calorie options?",
            "Could you help me pronounce this dish?",
            "Is there a time limit for dining?",
            "Do you have any options for people with food allergies?",
            "Could I have my coffee with almond milk, please?",
            "Is there a dress code for dining here?",
            "Do you have any recommendations for cocktails?",
            "Could I have the check split evenly between us?",
            "Is there a charge for substitutions?",
            "Do you offer any birthday specials?",
            "Could I order a side of fries with my meal?",
            "Is there a fee for using a credit card?",
            "Do you have a dog-friendly patio?",
            "Could I have my burger cooked well-done?",
            "Is there a children's menu available?",
            "Could you please pack the leftovers in separate containers?",
            "Do you have any non-alcoholic cocktails?",
            "Could I have my salad with the dressing on the side?",
            "Is there a service charge for large parties?",
            "Could you recommend a dish for someone who is gluten intolerant?",
            "Do you have any specials for holidays?",
            "Could you turn down the music a bit, please?",
            "Is it possible to make a reservation for later tonight?",
            "Could I have some extra cheese on my pasta, please?"
        ],
        'Restaurant_traductions': [ 
            "¿Podemos ver el menú, por favor?",
            "¿Tienen alguna opción vegetariana?",
            "¿Qué recomienda como especialidad de la casa?",
            "¿Podría hablarme de las especialidades de hoy?",
            "¿Este plato es picante?",
            "¿Podría pedir este plato sin cebolla, por favor?",
            "¿Ofrecen alternativas sin gluten?",
            "¿Cuánto tardará en llegar la comida?",
            "¿Me da un vaso de agua, por favor?",
            "¿Es posible dividir la cuenta?",
            "¿Tienen postres disponibles?",
            "¿Podría darme más servilletas, por favor?",
            "¿La propina está incluida en la cuenta?",
            "¿Pueden rellenarme la bebida?",
            "¿Tiene alguna recomendación para el maridaje de vinos?",
            "¿Ofrecen menús infantiles?",
            "¿Me traen pan mientras esperamos?",
            "¿Hay un pedido mínimo para entrega a domicilio?",
            "¿Puedo hacer una reserva para dos para esta noche?",
            "¿Podría poner más hielo en mi bebida, por favor?",
            "¿Ofrecen algún descuento para grupos grandes?",
            "¿Hay que pagar un descorche si traigo mi propio vino?",
            "¿Podría tener mi filete a término medio, por favor?",
            "¿Hay un límite de personas para una reserva?",
            "¿Tiene alguna recomendación para los aperitivos?",
            "¿Podría servirme un poco más de salsa?",
            "¿Es posible que me envíen la comida para llevar?",
            "¿Podría recomendarme un buen vino a un precio razonable?",
            "¿Disponen de asientos al aire libre?",
            "¿Podría darme la cuenta, por favor?",
            "¿Hay alguna hora feliz especial?",
            "¿Ofrecen alguna opción baja en calorías?",
            "¿Podría ayudarme a pronunciar este plato?",
            "¿Hay un límite de tiempo para cenar?",
            "¿Tienen alguna opción para personas con alergias alimentarias?",
            "¿Podría tomar mi café con leche de almendras, por favor?",
            "¿Hay algún código de vestimenta para cenar aquí?",
            "¿Tiene alguna recomendación de cócteles?",
            "¿Podría dividir la cuenta entre los dos?",
            "¿Hay que pagar por las sustituciones?",
            "¿Ofrecen algún especial de cumpleaños?",
            "¿Puedo pedir una guarnición de patatas fritas con mi comida?",
            "¿Hay que pagar por usar tarjeta de crédito?",
            "¿Tienen un patio apto para perros?",
            "¿Puedo pedir mi hamburguesa bien cocida?",
            "¿Hay menú infantil?",
            "¿Podría envasar las sobras en recipientes separados?",
            "¿Tienen cócteles sin alcohol?",
            "¿Podría servirme la ensalada con el aderezo aparte?",
            "¿Hay un cargo por servicio para fiestas grandes?",
            "¿Podría recomendarme un plato para alguien con intolerancia al gluten?",
            "¿Tienen algún especial para días festivos?",
            "¿Podría bajar un poco la música, por favor?",
            "¿Es posible hacer una reserva para esta noche?",
            "¿Podría ponerle más queso a mi pasta, por favor?"
        ],
        'Kitchen_phrases': [ 
            "Do we have enough eggs for the recipe?",
            "Can you pass me the cutting board, please?",
            "Where do we keep the measuring cups?",
            "Could you hand me the spatula?",
            "Do we have any olive oil left?",
            "Could you grab the salt from the pantry?",
            "What's the substitute for baking powder?",
            "Can you get the blender from the cabinet?",
            "Where do we keep the baking trays?",
            "Do we have any fresh herbs for garnish?",
            "Can you check if the oven is preheated?",
            "What's the difference between baking soda and baking powder?",
            "Do we have any parchment paper for lining the baking tray?",
            "Could you peel the potatoes for me?",
            "Where's the grater for the cheese?",
            "Can you help me find the whisk?",
            "Do we have any vanilla extract for the cake?",
            "Could you rinse the vegetables under cold water?",
            "What's the best way to sharpen the kitchen knives?",
            "Can you check if the meat is thawed in the refrigerator?",
            "Where do we store the spices and seasonings?",
            "Do we have any aluminum foil for wrapping leftovers?",
            "Could you chop the onions finely?",
            "Can you hand me the colander for draining the pasta?",
            "What can I use as a substitute for buttermilk?",
            "Do we have any unsalted butter?",
            "Could you help me open this jar, please?",
            "Where's the food processor for making the sauce?",
            "Can you find the rolling pin for flattening the dough?",
            "What's the difference between a saucepan and a skillet?",
            "Do we have any breadcrumbs for coating the chicken?",
            "Could you stir the sauce while I chop the vegetables?",
            "Can you get the baking dish from the cabinet?",
            "Where do we keep the plastic wrap for covering leftovers?",
            "Could you check if the milk has gone bad?",
            "Can you find the pastry brush for glazing the pastries?",
            "What's the proper way to store fresh produce in the fridge?",
            "Do we have any aluminum pans for baking?",
            "Could you help me sieve the flour?",
            "Where's the griddle for making pancakes?",
            "Can you pass me the tongs for flipping the meat?",
            "What's the difference between baking chocolate and cocoa powder?",
            "Do we have any parchment paper liners for the muffin tin?",
            "Could you slice the bread for the sandwiches?",
            "Can you locate the food coloring for decorating the cake?",
            "Where do we store the plastic containers for leftovers?",
            "Do we have any vegetable broth for the soup?",
            "Could you fetch the kitchen scale for measuring the ingredients?",
            "Can you help me tie the butcher's twine around the roast?"
        ],
        'Kitchen_traductions': [ 
            "¿Tenemos suficientes huevos para la receta?",
            "¿Me pasas la tabla de cortar, por favor?",
            "¿Dónde guardamos las tazas de medir?",
            "¿Me pasas la espátula?",
            "¿Nos queda aceite de oliva?",
            "¿Podrías coger la sal de la despensa?",
            "¿Cuál es el sustituto de la levadura en polvo?",
            "¿Puedes coger la batidora del armario?",
            "¿Dónde guardamos las bandejas para hornear?",
            "¿Tenemos hierbas frescas para la guarnición?",
            "¿Puedes comprobar si el horno está precalentado?",
            "¿Cuál es la diferencia entre bicarbonato sódico y levadura en polvo?",
            "¿Tenemos papel pergamino para forrar la bandeja del horno?",
            "¿Podrías pelarme las patatas?",
            "¿Dónde está el rallador para el queso?",
            "¿Puedes ayudarme a encontrar el batidor?",
            "¿Tenemos extracto de vainilla para la tarta?",
            "¿Podrías enjuagar las verduras con agua fría?",
            "¿Cuál es la mejor manera de afilar los cuchillos de cocina?",
            "¿Puedes comprobar si la carne está descongelada en la nevera?",
            "¿Dónde guardamos las especias y los condimentos?",
            "¿Tenemos papel de aluminio para envolver las sobras?",
            "¿Podrías picar las cebollas finamente?",
            "¿Puedes pasarme el escurridor para escurrir la pasta?",
            "¿Qué puedo usar como sustituto del suero de leche?",
            "¿Tenemos mantequilla sin sal?",
            "¿Podría ayudarme a abrir este tarro, por favor?",
            "¿Dónde está el robot de cocina para hacer la salsa?",
            "¿Puedes encontrar el rodillo para aplanar la masa?",
            "¿Cuál es la diferencia entre una cacerola y una sartén?",
            "¿Tenemos pan rallado para rebozar el pollo?",
            "¿Podrías remover la salsa mientras corto las verduras?",
            "¿Puedes coger la fuente de horno del armario?",
            "¿Dónde guardamos el envoltorio de plástico para cubrir las sobras?",
            "¿Podrías comprobar si la leche se ha echado a perder?",
            "¿Puedes encontrar la brocha para glasear los pasteles?",
            "¿Cuál es la forma correcta de guardar los productos frescos en la nevera?",
            "¿Tenemos moldes de aluminio para hornear?",
            "¿Podrías ayudarme a tamizar la harina?",
            "¿Dónde está la plancha para hacer tortitas?",
            "¿Me pasas las pinzas para dar la vuelta a la carne?",
            "¿Cuál es la diferencia entre el chocolate para hornear y el cacao en polvo?",
            "¿Tenemos forros de papel pergamino para el molde de magdalenas?",
            "¿Podrías cortar el pan para los sándwiches?",
            "¿Puedes localizar el colorante alimentario para decorar la tarta?",
            "¿Dónde guardamos los recipientes de plástico para las sobras?",
            "¿Tenemos caldo de verduras para la sopa?",
            "¿Puedes traer la balanza de cocina para medir los ingredientes?",
            "¿Puedes ayudarme a atar el cordel de carnicero alrededor del asado?"
        ],
        'Traveling_phrases': [ 
            "Could you help me book a hotel room for two nights?",
            "Is there availability for a single room with a king-sized bed?",
            "Could you confirm my reservation for tomorrow night?",
            "What time is check-in/check-out?",
            "Could you arrange for airport transportation?",
            "Is breakfast included in the room rate?",
            "Could I request a wake-up call for 6:00 AM, please?",
            "Do you have a shuttle service to the airport?",
            "Could you provide extra towels in the room?",
            "What amenities are available in the hotel?",
            "Could I have a non-smoking room, please?",
            "Is there a minibar in the room?",
            "Could you recommend a good restaurant nearby?",
            "What's the Wi-Fi password for the hotel?",
            "Is there a gym or fitness center at the hotel?",
            "Could you help me with my luggage?",
            "Is there a safe deposit box in the room?",
            "Could you provide an extra pillow, please?",
            "What time does the hotel restaurant close?",
            "Could you assist me with printing my boarding pass?",
            "Is there an ATM in the hotel?",
            "Could you call me a taxi for tomorrow morning?",
            "What's the policy for late check-out?",
            "Could I have a room with a view, please?",
            "Is there 24-hour room service available?",
            "Could you provide an iron and ironing board?",
            "What's the cancellation policy for the reservation?",
            "Could I have a map of the local area?",
            "Is there a business center where I can print documents?",
            "Could you recommend any tourist attractions nearby?",
            "What's the distance from the hotel to the airport?",
            "Could you arrange for a tour of the city?",
            "Is there a concierge available to assist with bookings?",
            "Could you help me extend my stay for another night?",
            "What's the procedure for lost and found items?",
            "Could you provide information on nearby public transportation?",
            "Is there a swimming pool available for guests?",
            "Could you recommend a good place to exchange currency?",
            "What's the policy for pets in the hotel?",
            "Could you assist me with printing my itinerary?",
            "Is there a place to store luggage after check-out?",
            "Could you provide a list of recommended restaurants in the area?",
            "What's the policy for early check-in?",
            "Could you help me with my online check-in for my flight?",
            "Is there a spa or massage service available at the hotel?",
            "Could you arrange for a taxi to pick me up from the airport?",
            "What's the policy for children staying in the hotel?",
            "Could you assist me with arranging a rental car?",
            "Is there a bar or lounge area in the hotel?",
            "Could you provide information on any local events happening during my stay?"
        ],
        'Traveling_traductions': [ 
            "¿Podría ayudarme a reservar una habitación de hotel para dos noches?",
            "¿Hay disponibilidad para una habitación individual con cama tamaño 'king'?",
            "¿Podría confirmar mi reserva para mañana por la noche?",
            "¿A qué hora es el check-in/check-out?",
            "¿Podría organizar el transporte al aeropuerto?",
            "¿Está incluido el desayuno en el precio de la habitación?",
            "¿Podría solicitar que me despierten a las 6:00 AM, por favor?",
            "¿Tienen servicio de transporte al aeropuerto?",
            "¿Podría proporcionar toallas adicionales en la habitación?",
            "¿De qué servicios dispone el hotel?",
            "¿Podría darme una habitación para no fumadores, por favor?",
            "¿Hay minibar en la habitación?",
            "¿Podría recomendarme un buen restaurante cercano?",
            "¿Cuál es la contraseña del Wi-Fi del hotel?",
            "¿Hay gimnasio o centro de fitness en el hotel?",
            "¿Podría ayudarme con mi equipaje?",
            "¿Hay caja fuerte en la habitación?",
            "¿Podría proporcionarme una almohada extra, por favor?",
            "¿A qué hora cierra el restaurante del hotel?",
            "¿Podría ayudarme a imprimir mi tarjeta de embarque?",
            "¿Hay un cajero automático en el hotel?",
            "¿Podría pedirme un taxi para mañana por la mañana?",
            "¿Cuál es la política de salida tardía?",
            "¿Podría darme una habitación con vistas, por favor?",
            "¿Hay servicio de habitaciones 24 horas?",
            "¿Pueden proporcionar plancha y tabla de planchar?",
            "¿Cuál es la política de cancelación de la reserva?",
            "¿Podría darme un mapa de la zona?",
            "¿Hay un centro de negocios donde pueda imprimir documentos?",
            "¿Podría recomendarme alguna atracción turística cercana?",
            "¿Cuál es la distancia del hotel al aeropuerto?",
            "¿Podría organizar una visita guiada por la ciudad?",
            "¿Hay un conserje disponible para ayudar con las reservas?",
            "¿Podrían ayudarme a prolongar mi estancia una noche más?",
            "¿Cuál es el procedimiento para objetos perdidos?",
            "¿Podría facilitarme información sobre el transporte público cercano?",
            "¿Hay piscina a disposición de los huéspedes?",
            "¿Podría recomendarnos un buen lugar para cambiar divisas?",
            "¿Cuál es la política para mascotas en el hotel?",
            "¿Podría ayudarme a imprimir mi itinerario?",
            "¿Hay algún lugar donde guardar el equipaje después de la salida?",
            "¿Podría facilitarme una lista de restaurantes recomendados en la zona?",
            "¿Cuál es la política de early check-in?",
            "¿Podría ayudarme con la facturación online de mi vuelo?",
            "¿Hay servicio de spa o masajes en el hotel?",
            "¿Podrían organizar un taxi para recogerme en el aeropuerto?",
            "¿Cuál es la política para los niños que se alojan en el hotel?",
            "¿Podría ayudarme a conseguir un coche de alquiler?",
            "¿Hay bar o sala de estar en el hotel?",
            "¿Podría proporcionarme información sobre cualquier evento local que tenga lugar durante mi estancia?"
        ],
    };

    // Función para expandir las contracciones
    function expandContractions(text) {
        const contractions = {
            "ain't": "is not",
            "aren't": "are not",
            "can't": "cannot",
            "can't've": "cannot have",
            "'cause": "because",
            "could've": "could have",
            "couldn't": "could not",
            "couldn't've": "could not have",
            "didn't": "did not",
            "doesn't": "does not",
            "don't": "do not",
            "hadn't": "had not",
            "hadn't've": "had not have",
            "hasn't": "has not",
            "haven't": "have not",
            "he'd": "he would",
            "he'd've": "he would have",
            "he'll": "he will",
            "he'll've": "he will have",
            "he's": "he is",
            "how'd": "how did",
            "how'd'y": "how do you",
            "how'll": "how will",
            "how's": "how is",
            "I'd": "I would",
            "I'd've": "I would have",
            "I'll": "I will",
            "I'll've": "I will have",
            "I'm": "I am",
            "I've": "I have",
            "isn't": "is not",
            "it'd": "it had",
            "it'd've": "it would have",
            "it'll": "it will",
            "it'll've": "it will have",
            "it's": "it is",
            "let's": "let us",
            "ma'am": "madam",
            "mayn't": "may not",
            "might've": "might have",
            "mightn't": "might not",
            "mightn't've": "might not have",
            "must've": "must have",
            "mustn't": "must not",
            "mustn't've": "must not have",
            "needn't": "need not",
            "needn't've": "need not have",
            "o'clock": "of the clock",
            "oughtn't": "ought not",
            "oughtn't've": "ought not have",
            "shan't": "shall not",
            "sha'n't": "shall not",
            "shan't've": "shall not have",
            "she'd": "she would",
            "she'd've": "she would have",
            "she'll": "she will",
            "she'll've": "she will have",
            "she's": "she is",
            "should've": "should have",
            "shouldn't": "should not",
            "shouldn't've": "should not have",
            "so've": "so have",
            "so's": "so is",
            "that'd": "that would",
            "that'd've": "that would have",
            "that's": "that is",
            "there'd": "there had",
            "there'd've": "there would have",
            "there's": "there is",
            "they'd": "they would",
            "they'd've": "they would have",
            "they'll": "they will",
            "they'll've": "they will have",
            "they're": "they are",
            "they've": "they have",
            "to've": "to have",
            "wasn't": "was not",
            "we'd": "we had",
            "we'd've": "we would have",
            "we'll": "we will",
            "we'll've": "we will have",
            "we're": "we are",
            "we've": "we have",
            "weren't": "were not",
            "what'll": "what will",
            "what'll've": "what will have",
            "what're": "what are",
            "what's": "what is",
            "what've": "what have",
            "when's": "when is",
            "when've": "when have",
            "where'd": "where did",
            "where's": "where is",
            "where've": "where have",
            "who'll": "who will",
            "who'll've": "who will have",
            "who's": "who is",
            "who've": "who have",
            "why's": "why is",
            "why've": "why have",
            "will've": "will have",
            "won't": "will not",
            "won't've": "will not have",
            "would've": "would have",
            "wouldn't": "would not",
            "wouldn't've": "would not have",
            "y'all": "you all",
            "y'alls": "you alls",
            "y'all'd": "you all would",
            "y'all'd've": "you all would have",
            "y'all're": "you all are",
            "y'all've": "you all have",
            "you'd": "you had",
            "you'd've": "you would have",
            "you'll": "you you will",
            "you'll've": "you you will have",
            "you're": "you are",
            "you've": "you have",
            "-": " "
        };
    
        return text.replace(/\b\w+['’]\w+\b/g, function(match) {
            return contractions[match] || match;
        });
    }

    const listenButton = document.getElementById('listenButton');
    const phraseElement = document.getElementById('Phrase');
    const message = document.getElementById('recognizedText');
    const tryAgainButton = document.getElementById('tryAgainButton');
    const tryAnotherButton = document.getElementById('tryAnotherButton');
    let understood = false;
    let microphone = false;
    const jsConfetti = new JSConfetti();

    // Inicializa recognizedText con el mensaje inicial
    message.textContent = "Press the button when you're ready to talk";

    listenButton.addEventListener('click', () => {
        const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition || window.mozSpeechRecognition || window.msSpeechRecognition)();
        recognition.lang = 'en-US';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        // Actualiza el mensaje inicial
        message.textContent = "Press the button when you're ready to talk";
        
        recognition.start();

        recognition.onstart = () => {
            microphone = true;
            // Actualiza recognizedText a "Listening..." cuando el micrófono esté activo
            message.textContent = "Listening...";
            // Mantiene desactivado el botón, le cambia el color de fondo, y no permite el click
            listenButton.disabled = true;
            speakButton.disabled = true;
            // Reactiva los botones Try Again y Try Another
            tryAgainButton.disabled = false;
            tryAnotherButton.disabled = false;
            console.log('OnStart: ', understood);
        };

        recognition.onresult = (event) => {
            console.log('OnResult 1: ', understood);
            const speechResult = expandContractions(event.results[0][0].transcript.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()¿¡?!]/g,""));
            const targetPhrase = expandContractions(phraseElement.textContent.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()¿¡?!]/g,""));
            if (speechResult === targetPhrase) {
                message.textContent = 'Correct, but could be better!';
                // Actualiza recognizedText con el texto reconocido dependiendo del nivel de confianza
                if (event.results[0][0].confidence >= 0.975) {
                    message.textContent = 'Excellent!';
                    jsConfetti.addConfetti({confettiNumber: 1000});
                }
                else if (event.results[0][0].confidence >= 0.95) {
                    message.textContent = 'Great!';
                    jsConfetti.addConfetti({confettiNumber: 400});
                }
                else if (event.results[0][0].confidence >= 0.9) {
                    message.textContent = 'Good!';
                    jsConfetti.addConfetti({confettiNumber: 150});
                }
                else {
                    jsConfetti.addConfetti({confettiNumber: 50});
                }
                // Agrega el porcentaje de confianza al mensaje, redondeado a dos decimales
                message.textContent += '\nConfidence: ' + (event.results[0][0].confidence * 100).toFixed(2) + '%';
                understood = true;
            } else {
                // Actualiza recognizedText con el texto reconocido
                message.textContent = 'Try Again. I understood: "' + event.results[0][0].transcript + '"';
                understood = true;
            }
            console.log('OnResult 2: ', understood);
        };

        recognition.onspeechend = () => {
            recognition.stop();
        };
    
        recognition.onerror = (event) => {
            console.log('OnError: ', understood);
            // Mantiene desactivado el botón, le cambia el color de fondo, y no permite el click
            listenButton.disabled = true;
            speakButton.disabled = true;
            // Reactiva los botones Try Again y Try Another
            tryAgainButton.disabled = false;
            tryAnotherButton.disabled = false;
            if (event.error === 'no-speech') {
                message.textContent = "I didn't understand you. Try again!";
            }
            else if (event.error === 'audio-capture') {
                message.textContent = 'No microphone was found. Connect a microphone and try again!';
            }
            else if (event.error === 'not-allowed') {
                message.textContent = 'Permission to use the microphone is blocked. Change the permission in the settings and try again!';
            }
            else {
                message.textContent = 'An error occurred. Try again!';
            }
        };

        recognition.onend = () => {
            console.log('OnEnd: ', understood);
            if (!microphone) {
                // Actualiza recognizedText con el mensaje de error
                message.textContent = 'No microphone was found. Connect a microphone and try again!';
            }
            else if (!understood) {
                // Actualiza recognizedText con el mensaje de error
                message.textContent = 'Try Again. I did not understand you!';
            }
        };

    });

    tryAgainButton.addEventListener('click', () => {
        // Reactiva el botón
        listenButton.disabled = false;
        speakButton.disabled = false;
        // Inicializa recognizedText con el mensaje inicial
        message.textContent = "Press the button when you're ready to talk";
        // Mantiene desactivados los botones Try Again y Try Another
        tryAgainButton.disabled = true;
        tryAnotherButton.disabled = true;
    });

    tryAnotherButton.addEventListener('click', function() {
        // Recarga la página para obtener una nueva frase y categoría
        location.reload();
    });

    // Función para mostrar una lista en un contenedor
    function obtenerIndiceAleatorio(longitudLista) {
        return Math.floor(Math.random() * longitudLista);
    }

    // Mostrar las listas correspondientes
    var contenedorLista1 = document.getElementById('Phrase');
    var contenedorLista2 = document.getElementById('Traduction');

    if (listas[lista1] && listas[lista2]) {
        var indiceAleatorio = obtenerIndiceAleatorio(listas[lista1].length);
        contenedorLista1.textContent = listas[lista1][indiceAleatorio];
        contenedorLista2.textContent = listas[lista2][indiceAleatorio];
    } else {
        contenedorLista1.textContent = 'Something went wrong. Please try again later!';
        contenedorLista2.textContent = 'Something went wrong. Please try again later!';
    }

    // Función para hablar la frase actual
    function speakPhrase() {
        const phraseElement = document.getElementById('Phrase');
        const phraseText = phraseElement.textContent;

        // Crear una nueva instancia de SpeechSynthesisUtterance
        const utterance = new SpeechSynthesisUtterance(phraseText);
        // Establecer el idioma a inglés británico o americano aleatoriamente
        utterance.lang = Math.random() < 0.5 ? 'en-GB' : 'en-US';

        // Se desactiva el botón de hablar y escuchar mientras se reproduce el audio
        document.getElementById('speakButton').disabled = true;
        document.getElementById('listenButton').disabled = true;

        // Agregar un evento para reactivar el botón una vez que el audio haya terminado
        utterance.onend = function() {
            document.getElementById('speakButton').disabled = false;
            document.getElementById('listenButton').disabled = false;
        };

        // Hablar la frase
        window.speechSynthesis.speak(utterance);
    }

    // Agregar el event listener al nuevo botón
    document.getElementById('speakButton').addEventListener('click', speakPhrase);

});

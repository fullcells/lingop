// CEFR here actually refers to the "CampLingoV1-Learn" mode - which didn't have Qs+As, and was more Duolingo-like in relying on questioning differing formats (Translations, Audio), and Fill-in-the-Words.
// This data was extracted on 20260102. At the time of extraction, the most recent created_at: for CEFR_CONCEPT was 2023-10-05 , for CEFR_TOPIC was 2023-10-21.

export interface CEFRConcept {
	id: number;
	label: string;
	phrases: string[]; // 20260102: converted from original sb " • " delimited entries // Entries with empty phrases are represented as `[]` (e.g. grandpa (whereas maternal/paternal grandpa have phrases)) - empty phrases persists to help determine 'Salience' (aka "Important Word (aka .label) that should be learnt")
}

export interface CEFRTopicEntry {
	// 20260101 Note: Exact same structure as Old CampLingo Supabase maintained for now, whilst porting is in progress. Can be reformatted in future if “Learn-CEFR (Classic)” is ever revisited.
	id: number;
	topic: string;
	topic_order: number;
	concept_id: number;
}

export interface TopicValidConceptsDatum {
	topic: string;
	valid_concept_ids: number[];
	valid_size: number;
}

export interface CEFRViewConceptWithTopic {
	topic_id: number;
	topic: string;
	topic_order: number;
	concept_id: number;
	label: string;
	phrases: string[];
}

// Note: Still includes empty concepts with empty phrases (`[]`) // aka fetchConcepts
export const cefrConcepts: CEFRConcept[] = [
 {
	 "id": 1,
	 "label": "Nice to meet you",
	 "phrases": ["Nice to meet you"]
 },
 {
	 "id": 2,
	 "label": "name",
	 "phrases": ["What is your name?","My name is Alex","Her name is Julie"]
 },
 {
	 "id": 3,
	 "label": "from",
	 "phrases": ["This book is from the library","He has a book from school","This apple is from the park"]
 },
 {
	 "id": 4,
	 "label": "America",
	 "phrases": ["I am from America","I am American, I speak English."]
 },
 {
	 "id": 5,
	 "label": "Indian",
	 "phrases": ["He is from India","The girl is Indian","He is Indian. He likes eating yellow rice.","I am Indian. I do not eat meat."]
 },
 {
	 "id": 6,
	 "label": "Hindi",
	 "phrases": ["She is Indian. She can speak Hindi.","He speaks Hindi."]
 },
 {
	 "id": 7,
	 "label": "Japan",
	 "phrases": ["He is Japanese, he likes eating fish.","I am from Japan"]
 },
 {
	 "id": 8,
	 "label": "Japanese",
	 "phrases": ["She can speak Japanese"]
 },
 {
	 "id": 9,
	 "label": "France",
	 "phrases": ["I am from France, I like eating bread.","He is French."]
 },
 {
	 "id": 10,
	 "label": "French",
	 "phrases": ["I do not speak French","The boy can read French.","She is from France, she can speak French."]
 },
 {
	 "id": 11,
	 "label": "country",
	 "phrases": ["What country are you from?","I like going to different countries"]
 },
 {
	 "id": 12,
	 "label": "language",
	 "phrases": ["What languages can you speak?"]
 },
 {
	 "id": 13,
	 "label": "student",
	 "phrases": ["Are you a student?","He is a French student.","The student is at school."]
 },
 {
	 "id": 14,
	 "label": "teacher",
	 "phrases": ["The woman is a teacher","Is he a teacher?","The school has teachers"]
 },
 {
	 "id": 15,
	 "label": "doctor",
	 "phrases": ["The doctor is at the hospital","You are a doctor","The doctor has a blue shirt","The doctor is eating an apple"]
 },
 {
	 "id": 16,
	 "label": "farm",
	 "phrases": ["My farm has carrots","She has an apple farm","There are chickens at the farm"]
 },
 {
	 "id": 17,
	 "label": "farmer",
	 "phrases": ["There is a farmer at the farm","The farmer has blue pants"]
 },
 {
	 "id": 18,
	 "label": "work",
	 "phrases": ["She works at a school. She is a teacher.","Teachers work at schools."]
 },
 {
	 "id": 19,
	 "label": "movie",
	 "phrases": ["You like to watch movies","She does not like watching movies","The man is watching a movie","Do you like to watch movies?","This movie is not good","This movie has people that speak Hindi"]
 },
 {
	 "id": 20,
	 "label": "cook",
	 "phrases": ["I like to cook food","He likes cooking"]
 },
 {
	 "id": 21,
	 "label": "sport",
	 "phrases": ["He likes to play sports","You do not like playing sports","The students are playing sport","Do you like playing sports?","What sport do you like to play?","Soccer is a sport","She likes to play sports","I like playing sports"]
 },
 {
	 "id": 22,
	 "label": "museum",
	 "phrases": ["She likes going to museums","The teacher likes to go to museums","The students are at the museum","I want to go to the museum"]
 },
 {
	 "id": 26,
	 "label": "mom",
	 "phrases": ["Is that woman your mom?","My mom's name is Julie","I am your mom"]
 },
 {
	 "id": 27,
	 "label": "wear",
	 "phrases": ["My mom is wearing a red dress","What are you wearing?","He is wearing a blue shirt"]
 },
 {
	 "id": 28,
	 "label": "dad",
	 "phrases": ["My dad is at the hospital","His dad is wearing a black shirt","Your dad is wearing a white jacket"]
 },
 {
	 "id": 29,
	 "label": "who",
	 "phrases": ["Who is your dad?","Who is the man in the white shirt?","Who is the girl with the yellow dress?"]
 },
 {
	 "id": 30,
	 "label": "whose",
	 "phrases": ["Whose dress is this?","Whose book is this?","Whose shirt is this?","Whose pants are these?"]
 },
 {
	 "id": 31,
	 "label": "son",
	 "phrases": ["My son is at the park","Her son is at school","His son can speak Japanese"]
 },
 {
	 "id": 32,
	 "label": "daughter",
	 "phrases": ["My daughter is going to school","His daughter is over there","Her daughter likes to read books"]
 },
 {
	 "id": 33,
	 "label": "child",
	 "phrases": ["My child is wearing a yellow shirt","Do you have any children?"]
 },
 {
	 "id": 34,
	 "label": "parent",
	 "phrases": ["My parent is here","His parent is at the school","Where are your parents?"]
 },
 {
	 "id": 60,
	 "label": "need",
	 "phrases": ["I need to go to the toilet","I need to drink water","I need to eat food","I am cold. I need a jacket."]
 },
 {
	 "id": 61,
	 "label": "hotel",
	 "phrases": ["Where is the hotel?","The hotel is there","The hotel is next to the park"]
 },
 {
	 "id": 62,
	 "label": "airport",
	 "phrases": ["Are you at the airport?","He is going to the airport","I need to go to the Airport"]
 },
 {
	 "id": 63,
	 "label": "ATM",
	 "phrases": ["The ATM is there","I need an ATM","I need to go to an ATM","There is an ATM at the hotel","Where is the ATM?"]
 },
 {
	 "id": 64,
	 "label": "taxi",
	 "phrases": ["The taxi is yellow","I need a taxi to go to my hotel","There are taxis at the airport"]
 },
 {
	 "id": 65,
	 "label": "car",
	 "phrases": ["The car is blue","The car is going to the hotel","I like this bus"]
 },
 {
	 "id": 66,
	 "label": "bus",
	 "phrases": ["There is a bus that goes to the museum","I do not like this bus","The bus is at the park","The bus is yellow"]
 },
 {
	 "id": 67,
	 "label": "train",
	 "phrases": ["The train is going to the airport","The train is at the library","The train is white"]
 },
 {
	 "id": 68,
	 "label": "walk",
	 "phrases": ["I like walking to school","He walked to the park","She is walking my house","You can walk to the museum"]
 },
 {
	 "id": 69,
	 "label": "bike",
	 "phrases": ["Do you have a bike?","The bike is blue","There are bikes at the park"]
 },
 {
	 "id": 70,
	 "label": "Taxi stand",
	 "phrases": ["There is a taxi at the taxi stand","The taxi stand is over there","There is a taxi stand next to the hospital"]
 },
 {
	 "id": 71,
	 "label": "Bus stop",
	 "phrases": ["There are no buses at the bus stop","There is a bus stop at the school","There is a bus at the bus stop","The hotel is next to the bus stop"]
 },
 {
	 "id": 72,
	 "label": "Train station",
	 "phrases": ["There are no people at the train station","There is a train at the train station","There is a train station next to the museum","You can walk to the train station"]
 },
 {
	 "id": 73,
	 "label": "station",
	 "phrases": []
 },
 {
	 "id": 74,
	 "label": "airplane",
	 "phrases": ["The airplane is big","The airplane is at the airport"]
 },
 {
	 "id": 75,
	 "label": "ferry",
	 "phrases": ["The ferry is big","The ferry is cold","I need to go to the ferry"]
 },
 {
	 "id": 76,
	 "label": "ride",
	 "phrases": ["You can ride the bus to the museum","He is riding a taxi","She is riding a train to the hospital"]
 },
 {
	 "id": 77,
	 "label": "one",
	 "phrases": ["He has one apple","She has one dad","You have one red jacket"]
 },
 {
	 "id": 78,
	 "label": "two",
	 "phrases": ["The house has two toilets"]
 },
 {
	 "id": 79,
	 "label": "three",
	 "phrases": ["There are two people in the taxi"]
 },
 {
	 "id": 80,
	 "label": "four",
	 "phrases": ["There are four people in the car"]
 },
 {
	 "id": 81,
	 "label": "five",
	 "phrases": ["There are five boys at the park"]
 },
 {
	 "id": 82,
	 "label": "six",
	 "phrases": ["There are six people at the house"]
 },
 {
	 "id": 83,
	 "label": "seven",
	 "phrases": ["She has seven apples"]
 },
 {
	 "id": 84,
	 "label": "eight",
	 "phrases": ["There are eight airplanes at the airport"]
 },
 {
	 "id": 85,
	 "label": "nine",
	 "phrases": ["He ate nine carrots"]
 },
 {
	 "id": 86,
	 "label": "ten",
	 "phrases": ["He has ten books"]
 },
 {
	 "id": 87,
	 "label": "eleven",
	 "phrases": ["There are eleven taxis at the taxi stand"]
 },
 {
	 "id": 88,
	 "label": "twelve",
	 "phrases": ["There are twelve people on the bus"]
 },
 {
	 "id": 89,
	 "label": "thirty",
	 "phrases": ["There are thirty people at the train station"]
 },
 {
	 "id": 90,
	 "label": "hundred",
	 "phrases": ["There are one hundred people at the library","The school has three hundred people"]
 },
 {
	 "id": 91,
	 "label": "thousand",
	 "phrases": ["There are one thousand people at the park"]
 },
 {
	 "id": 92,
	 "label": "How many",
	 "phrases": ["How many buses at at the bus stop?","How many people are at the taxi stand?","How many books do you have?","How many books have you read?","How many taxis are there?","How many people are at the park?","How many carrots do you want?"]
 },
 {
	 "id": 93,
	 "label": "How",
	 "phrases": []
 },
 {
	 "id": 94,
	 "label": "many",
	 "phrases": []
 },
 {
	 "id": 95,
	 "label": "A lot",
	 "phrases": []
 },
 {
	 "id": 96,
	 "label": "lot",
	 "phrases": []
 },
 {
	 "id": 97,
	 "label": "few",
	 "phrases": []
 },
 {
	 "id": 98,
	 "label": "zero",
	 "phrases": ["There are zero buses at the taxi stand","How many buses at at the taxi stand? Zero.","He has zero dresses"]
 },
 {
	 "id": 99,
	 "label": "turn",
	 "phrases": ["He turned to her","The girl turned to the boy"]
 },
 {
	 "id": 100,
	 "label": "left",
	 "phrases": ["Go left","the park is to the left of the hospital","the book is to the left of the apple","turn left at the hospital","you need to turn left at the school"]
 },
 {
	 "id": 101,
	 "label": "right",
	 "phrases": ["Turn right at the library","The museum is to the right of the school","The toilet is to the right of the red ATM"]
 },
 {
	 "id": 102,
	 "label": "straight",
	 "phrases": ["Go straight","walk straight"]
 },
 {
	 "id": 103,
	 "label": "ahead",
	 "phrases": ["the hospital is straight ahead","go straight ahead"]
 },
 {
	 "id": 104,
	 "label": "direction",
	 "phrases": ["Which direction is the house?","The toilet is in that direction","What direction is the book store?"]
 },
 {
	 "id": 105,
	 "label": "minute",
	 "phrases": ["Walk straight ahead for 5 minutes"]
 },
 {
	 "id": 106,
	 "label": "meter",
	 "phrases": ["Walk straight ahead for 30 meters"]
 },
 {
	 "id": 107,
	 "label": "kilometer",
	 "phrases": ["Walk straight ahead for 3 kilometer"]
 },
 {
	 "id": 108,
	 "label": "mile",
	 "phrases": ["Walk straight ahead for 2 mile"]
 },
 {
	 "id": 109,
	 "label": "buy",
	 "phrases": ["Where can I buy apples?","I want to buy books","He is buying a tv","I need to buy a dress","You are buying chicken"]
 },
 {
	 "id": 110,
	 "label": "store",
	 "phrases": ["He is buying apples at a fruit store","He is buying a shirt at the clothes store","I want to go to the book store"]
 },
 {
	 "id": 111,
	 "label": "How much",
	 "phrases": ["How much is this?","How much did you eat?","How much music do you listen too?","How much tv does she watch?","How much are 6 carrots?","How much water did he drink?"]
 },
 {
	 "id": 112,
	 "label": "cost",
	 "phrases": ["How much does this cost?","What is the cost of the jacket?","How much does 5 apples cost?","How much does this museum cost?","I want that. How much does it cost?"]
 },
 {
	 "id": 113,
	 "label": "Which",
	 "phrases": ["Which apple do you want?","Which park do you want to go too?","Which person do you like?","Which color do you like?","Which shirt does your boy want?"]
 },
 {
	 "id": 114,
	 "label": "phone",
	 "phrases": ["His phone is white","The park has a phone","How much does this phone cost?","Is there a phone here?"]
 },
 {
	 "id": 115,
	 "label": "call",
	 "phrases": ["I need to call the hospital","Please call her"]
 },
 {
	 "id": 116,
	 "label": "help",
	 "phrases": ["He needs help","Do you need help?","Who do I call for help?","Please call for help"]
 },
 {
	 "id": 117,
	 "label": "police",
	 "phrases": ["Where is the police?","She needs the police","Can the police help me?"]
 },
 {
	 "id": 118,
	 "label": "wallet",
	 "phrases": ["My wallet is black","He does not have his wallet","I need my wallet"]
 },
 {
	 "id": 119,
	 "label": "find",
	 "phrases": ["I can not find my wallet","He found his book","Please help me find my son","The girl found her jacket","Can you help me find my daughter?","I found my wallet!","Please help me find my book","Did you find your jacket?"]
 },
 {
	 "id": 120,
	 "label": "lost",
	 "phrases": ["I lost my boy","He lost his wallet","Are you lost?","She lost her mom"]
 },
 {
	 "id": 121,
	 "label": "take",
	 "phrases": ["The man took my wallet","He is taking her book","The police took that man"]
 },
 {
	 "id": 122,
	 "label": "fire",
	 "phrases": ["There is a fire","The house is on fire","He is watching the fire","The fire is red","The fire is yellow","The fire is hot","The fire is big"]
 },
 {
	 "id": 123,
	 "label": "make",
	 "phrases": ["I like to make clothes","He is making a book","She is making a jacket","You are making a movie","The farmer is making milk","You are making bread"]
 },
 {
	 "id": 124,
	 "label": "chef",
	 "phrases": ["He is a chef","The chef is making food","The chef likes to make good food","The chef is cooking food","The chef is working in the restaurant","The cook is wearing a white jacket"]
 },
 {
	 "id": 125,
	 "label": "draw",
	 "phrases": ["I like to draw food","He is drawing in the book","She likes to draw him","That man is drawing a house","You are drawing in the park"]
 },
 {
	 "id": 126,
	 "label": "artist",
	 "phrases": ["The artist likes to draw","He is an artist","She is an artist, she likes to draw clothes","The artist is wearing red pants"]
 },
 {
	 "id": 127,
	 "label": "firefighter",
	 "phrases": ["He is a fire fighter","The fire fighter is at the park","The fire fighter likes to help people","She is a fire fighter. She helps people.","The firefighter has a black jacket","The firefighter is wearing a yellow jacket"]
 },
 {
	 "id": 128,
	 "label": "policeman",
	 "phrases": ["The policeman likes to help people","The policeman is in the park","The policeman is watching a bad man","The policeman is wearing a blue shirt"]
 },
 {
	 "id": 129,
	 "label": "librarian",
	 "phrases": ["The librarian works in the library","The librarian closes the library","The librarian is reading a book","The librarian has a black book","She is a librarian","The librarian is wearing a yellow shirt"]
 },
 {
	 "id": 130,
	 "label": "scientist",
	 "phrases": ["She is a scientist","The scientist likes to read books","The scientist is at the school","The scientist has a white jacket"]
 },
 {
	 "id": 131,
	 "label": "plumber",
	 "phrases": ["The plumber is wearing a blue jacket","He is a plumber","The plumber is in the house","The plumber is drinking water"]
 },
 {
	 "id": 132,
	 "label": "factory",
	 "phrases": ["She makes clothes at the factory","The factory has clothes","The factory makes books","He works at the factory"]
 },
 {
	 "id": 133,
	 "label": "construction site",
	 "phrases": ["He works at the construction site","The library is next to the construction site","Do you work at a construction site?"]
 },
 {
	 "id": 134,
	 "label": "office building",
	 "phrases": ["She works at an office building","Do you work in an office building?","This office building is white","I am going to that office building"]
 },
 {
	 "id": 135,
	 "label": "sibling",
	 "phrases": ["Do you have any siblings?","I have 2 siblings","How many siblings do you have?"]
 },
 {
	 "id": 136,
	 "label": "brother",
	 "phrases": ["My brother likes to eat apples","His brother is at school","Do you have any brothers?"]
 },
 {
	 "id": 137,
	 "label": "older brother",
	 "phrases": ["My older brother is in school","I want an older brother","His older brother likes to play with him","Where is your older brother?"]
 },
 {
	 "id": 138,
	 "label": "younger brother",
	 "phrases": ["His younger brother is at the park","I have a younger brother","Her younger brother likes to watch tv","His younger brother likes to play in the park"]
 },
 {
	 "id": 139,
	 "label": "sister",
	 "phrases": ["My sister likes to drink water","Her sister is at the library","How many sisters do you have?"]
 },
 {
	 "id": 140,
	 "label": "older sister",
	 "phrases": ["I have an older sister","His older sister is in the hospital","My older sister likes to read books"]
 },
 {
	 "id": 141,
	 "label": "younger sister",
	 "phrases": ["She has a younger sister","My younger sister is not here","Your younger sister likes red dresses","Where is your younger sister?"]
 },
 {
	 "id": 142,
	 "label": "in",
	 "phrases": ["He is in the taxi","She is in school","My wallet is in the library","The toilet is inside the library","I am inside the hospital"]
 },
 {
	 "id": 143,
	 "label": "on",
	 "phrases": ["I am on the train station","The apple is on the book","There is a carrot on your shirt"]
 },
 {
	 "id": 144,
	 "label": "city",
	 "phrases": ["I need to go to the city","The city is next to the beach","The library is in the city","She likes going to the city"]
 },
 {
	 "id": 145,
	 "label": "beach",
	 "phrases": ["He is on the beach","I am at the beach","The beach is hot","The beach is yellow","She is not at the beach","The beach is one kilometer from here","I like walking on the beach"]
 },
 {
	 "id": 146,
	 "label": "mountain",
	 "phrases": ["I am on the mountain","The mountain is big","I lost my wallet on the mountain"]
 },
 {
	 "id": 147,
	 "label": "lake",
	 "phrases": ["The ferry is on the lake","The lake is cold","The lake is blue","The lake is big","Are you at the lake?"]
 },
 {
	 "id": 148,
	 "label": "restaurant",
	 "phrases": ["He is eating food at the restaurant","I am inside the restaurant","Where is the restaurant?","Is she at the restaurant?"]
 },
 {
	 "id": 149,
	 "label": "shopping center",
	 "phrases": ["The shopping center is next to the park","She likes going to the shopping centre","I am buying clothes at the shopping center"]
 },
 {
	 "id": 150,
	 "label": "medicine",
	 "phrases": ["I need my medicine","He needs his medicine","Where can I buy medicine?"]
 },
 {
	 "id": 151,
	 "label": "pharmacy",
	 "phrases": ["The pharmacy is inside the hospital","The pharmacy has medicine","He needs to go to the pharmacy","You can buy medicine at that pharmacy","There is a pharmacy in the hospital","The doctor is at the pharmacy","He feels bad. Can you go to the pharmacy?","She got some medicine at the pharmacy."]
 },
 {
	 "id": 152,
	 "label": "supermarket",
	 "phrases": ["There are vegetables at supermarkets","You can buy carrots at that supermarket","This supermarket has milk","I need to buy apples at the supermarket"]
 },
 {
	 "id": 153,
	 "label": "embassy",
	 "phrases": ["I need to go to the embassy","The embassy can help her go home","Is he at the embassy?"]
 },
 {
	 "id": 154,
	 "label": "petrol station",
	 "phrases": ["I need a petrol station","Where is the petrol station?","Is there a petrol station next to the supermarket?"]
 },
 {
	 "id": 155,
	 "label": "building",
	 "phrases": ["The hospital is a white building","That blue building is the supermarket","This yellow building is a school","The toilet is inside that building"]
 },
 {
	 "id": 156,
	 "label": "bank",
	 "phrases": ["Where is the bank?","The bank is next to the park","There is an ATM inside that bank"]
 },
 {
	 "id": 157,
	 "label": "stairs",
	 "phrases": ["The toilet is next to the stairs","Your house has stairs","She is on the stairs"]
 },
 {
	 "id": 158,
	 "label": "up",
	 "phrases": ["Go up the stairs","the library is up the stairs","He is up there","His medicine is up there"]
 },
 {
	 "id": 159,
	 "label": "down",
	 "phrases": ["Go down the stairs","the toilet is down the stairs","I am down here","The book is down there"]
 },
 {
	 "id": 160,
	 "label": "change",
	 "phrases": ["I need to change my clothes","He changed his shirt","She changed her pants","Change buses here","Change trains at the next train station"]
 },
 {
	 "id": 161,
	 "label": "then",
	 "phrases": ["Go straight, then go right.","Walk over there, then it is on your left.","He ate the apple, then he went to sleep.","She drank some water, then she went to school."]
 },
 {
	 "id": 162,
	 "label": "north",
	 "phrases": ["The park is north of the city","Walk north for 5 minutes","Is the clothes store north of the library?"]
 },
 {
	 "id": 163,
	 "label": "south",
	 "phrases": ["My house is south of the park","She is south of the hospital","What is south of the school?"]
 },
 {
	 "id": 164,
	 "label": "east",
	 "phrases": ["He is east of the museum","The school is east of the fruit store","The restaurant is east of the hospital","The beach is east of the city"]
 },
 {
	 "id": 165,
	 "label": "west",
	 "phrases": ["The bus stop is west of the park","The book store is west of the school","What is west of the hospital?"]
 },
 {
	 "id": 166,
	 "label": "credit card",
	 "phrases": ["Do you have a credit card?","Can I use my credit card?","We do not take credit cards"]
 },
 {
	 "id": 167,
	 "label": "card",
	 "phrases": ["He forgot his library card","She likes reading birthday cards","He gave her flowers and a card","Do you want to play cards with me?","My big brother and big sister like to play cards",""]
 },
 {
	 "id": 168,
	 "label": "menu",
	 "phrases": ["The restaurant has menus","The restaurant menu is big"]
 },
 {
	 "id": 169,
	 "label": "vegetarian",
	 "phrases": ["She is a vegetarian","The vegetarian likes to eat apples","Are you a vegetarian?"]
 },
 {
	 "id": 170,
	 "label": "peanut",
	 "phrases": ["Can you eat peanuts?","He does not like eating peanuts","I can not eat peanuts","Does this food have peanuts?"]
 },
 {
	 "id": 171,
	 "label": "bill",
	 "phrases": ["He has the bill","The bill is big"]
 },
 {
	 "id": 172,
	 "label": "receipt",
	 "phrases": ["Can I have the receipt?","Do you have a receipt?","The receipt is white"]
 },
 {
	 "id": 173,
	 "label": "ambulance",
	 "phrases": ["She is in the ambulance","I need an ambulance","There is an ambulance at the restaurant","Do you need an ambulance?"]
 },
 {
	 "id": 174,
	 "label": "first aid",
	 "phrases": ["He needs first aid","You need first aid"]
 },
 {
	 "id": 175,
	 "label": "fire fighter",
	 "phrases": ["He is a fire fighter","Are you a fire fighter?"]
 },
 {
	 "id": 176,
	 "label": "police station",
	 "phrases": ["Where is the police station?","The police are at the police station","He is at the police station"]
 },
 {
	 "id": 177,
	 "label": "key",
	 "phrases": ["I lost my key","Do you have a key?","The key is yellow","Where is your key?","The key is in his wallet"]
 },
 {
	 "id": 178,
	 "label": "save",
	 "phrases": ["Please save me","She saved him","The fire fighter saved that woman"," The ambulance saved you",""]
 },
 {
	 "id": 179,
	 "label": "dangerous",
	 "phrases": ["The park is dangerous","That man is bad. He is dangerous.","She is dangerous","Is this dangerous?","The fire is dangerous"]
 },
 {
	 "id": 180,
	 "label": "life",
	 "phrases": ["The firefighter saved his life","The doctor is saving her life","That woman saved your life","Please save his life!","Help me save her life","The policeman wants to save lives","He is saving that person's life","The hospital saved my life"]
 },
 {
	 "id": 181,
	 "label": "die",
	 "phrases": ["Help! He is dying!","She is dying! Help!","Do not die!","The fish is dead","The chicken is dead","The firefighter is not dead","She is not dead"]
 },
 {
	 "id": 182,
	 "label": "a.m.",
	 "phrases": ["He goes to school at 8am","I eat food at 7am","She goes to the train station at 9:30 am"]
 },
 {
	 "id": 183,
	 "label": "p.m.",
	 "phrases": ["You watch tv at 7pm","I go to the park at 3pm","She went to the library at 1:30 pm"]
 },
 {
	 "id": 184,
	 "label": "o'clock",
	 "phrases": ["It is 8 o'clock","He ate food at 6 o'clock","She was at the library at 2 o'clock"]
 },
 {
	 "id": 185,
	 "label": "open",
	 "phrases": ["The book store is open","She opened the book","The clothing store opens at 8:30 am","He opened the food store"]
 },
 {
	 "id": 186,
	 "label": "close",
	 "phrases": ["The store is closed","Please close the book","The library closes at 5:00pm","She closed the book","He closed the library","The school is not open. The school is closed."]
 },
 {
	 "id": 187,
	 "label": "time",
	 "phrases": ["What time does the store open?","What time does the library close?","The time is 2:15 pm"]
 },
 {
	 "id": 188,
	 "label": "arrive",
	 "phrases": ["What time does the bus arrive?","He arrived at 10:00 am","The train arrived at 3:45 pm","The bus is arriving in 5 minutes","What time are you arriving to the park?"]
 },
 {
	 "id": 189,
	 "label": "leave",
	 "phrases": ["The train will leave in 1 minute","What time will the bus leave?","What time are you leaving school?","She is leaving the park"]
 },
 {
	 "id": 190,
	 "label": "now",
	 "phrases": ["She is arriving now","What is the time now?","He is eating food now","You are watching tv now","I am going to school now","She is listening to music now","The hospital is open now"]
 },
 {
	 "id": 191,
	 "label": "when",
	 "phrases": ["When does the bus arrive?","When does he arrive?","When will you arrive?","When are you eating?","When are you going to school?","When does the store open?","When does the library close?"]
 },
 {
	 "id": 192,
	 "label": "hour",
	 "phrases": ["He read the book for 3 hours","He went to school for 6 hours","How many hours is the store open?","There are 60 minutes in 1 hour"]
 },
 {
	 "id": 193,
	 "label": "Sunday",
	 "phrases": ["On Sunday, he played at the park","The school is closed on Sunday"]
 },
 {
	 "id": 194,
	 "label": "Monday",
	 "phrases": ["The school is open on Monday","She goes to school on Monday"]
 },
 {
	 "id": 195,
	 "label": "Tuesday",
	 "phrases": ["On Tuesday, I read books at school","You are going to the hotel on Tuesday"]
 },
 {
	 "id": 196,
	 "label": "Wednesday",
	 "phrases": ["You like going to the library on Wednesdays","On Wednesday, I want to go to the park"]
 },
 {
	 "id": 197,
	 "label": "Thursday",
	 "phrases": ["He needs to go to the hospital on Thursday","This store closes at 9 pm on Thursday"]
 },
 {
	 "id": 198,
	 "label": "Friday",
	 "phrases": ["On Friday, I want to go the museum","I called the hotel on Friday"]
 },
 {
	 "id": 199,
	 "label": "Saturday",
	 "phrases": ["I go to his house on Saturdays","The library is closed on Saturday","I need to go to the airport on Saturday"]
 },
 {
	 "id": 200,
	 "label": "today",
	 "phrases": ["Are you going to the library today?","What are you doing today?","I am going to the park today","She went to the clothing store today","He bought a shirt today","The library is not open today","Today is Wednesday","Today is not Saturday","What did you do today?","Where are you going today?"]
 },
 {
	 "id": 201,
	 "label": "day",
	 "phrases": ["What day is it today?"]
 },
 {
	 "id": 202,
	 "label": "night",
	 "phrases": ["What are you doing at night?","Where are you going at night?"]
 },
 {
	 "id": 203,
	 "label": "luggage",
	 "phrases": ["Have you seen my luggage?","His luggage is black","Where is your luggage?","My luggage is at the airport"]
 },
 {
	 "id": 204,
	 "label": "ticket",
	 "phrases": ["Do you have a bus ticket?","Where can I buy a train ticket?","Is this your plane ticket?","I lost my ticket"]
 },
 {
	 "id": 205,
	 "label": "platform",
	 "phrases": ["The platform is big","I need to go to platform 9","The train is on platform 3","Are you on the train platform?"]
 },
 {
	 "id": 206,
	 "label": "line",
	 "phrases": ["The yellow line goes to the hospital","This book has lines","The white line goes to the toilet"]
 },
 {
	 "id": 207,
	 "label": "wait",
	 "phrases": ["Please wait at the bus stop","Please wait here","He is waiting for the bus","She is waiting for the airplane","You are waiting on the platform","I is waiting for him"]
 },
 {
	 "id": 208,
	 "label": "rented",
	 "phrases": ["I need to rent a car","She wants to rent a bike","That man rented a red car"]
 },
 {
	 "id": 209,
	 "label": "cancel",
	 "phrases": ["The train has been cancelled","The plane was cancelled","The doctor cancelled","The game was canceled"]
 },
 {
	 "id": 210,
	 "label": "last",
	 "phrases": ["The last train leaves at 1:15 am","The last bus is here","The last bus leaves at 11:30 pm","Has he read the last book?","The library is the last building","The last train arrives at 1 am","The last bus has been cancelled"]
 },
 {
	 "id": 212,
	 "label": "like",
	 "phrases": []
 },
 {
	 "id": 213,
	 "label": "I",
	 "phrases": []
 },
 {
	 "id": 214,
	 "label": "you",
	 "phrases": ["I like you","You like me"]
 },
 {
	 "id": 215,
	 "label": "this",
	 "phrases": ["I like this","Do you like this?","You like this"]
 },
 {
	 "id": 216,
	 "label": "not",
	 "phrases": ["I not like","you do not like this","I do not like this"]
 },
 {
	 "id": 217,
	 "label": "food",
	 "phrases": ["I like food","Do you like food?"]
 },
 {
	 "id": 218,
	 "label": "water",
	 "phrases": ["You like water","I like water"]
 },
 {
	 "id": 219,
	 "label": "is",
	 "phrases": ["Is this you?","this is food","this is water"]
 },
 {
	 "id": 220,
	 "label": "hot",
	 "phrases": ["Not hot","Is this hot?","this food is hot","This water is hot"]
 },
 {
	 "id": 221,
	 "label": "clothes",
	 "phrases": ["i like clothes","You like clothes"]
 },
 {
	 "id": 222,
	 "label": "man",
	 "phrases": ["You are a man","the man likes food","The man does not like hot water"]
 },
 {
	 "id": 223,
	 "label": "woman",
	 "phrases": ["You are a woman","The woman likes clothes","The woman likes hot water"]
 },
 {
	 "id": 224,
	 "label": "they (singular)",
	 "phrases": []
 },
 {
	 "id": 225,
	 "label": "he",
	 "phrases": ["He likes food","he is a man","he likes you","I like the man"]
 },
 {
	 "id": 226,
	 "label": "she",
	 "phrases": ["She likes water","She is not a man","She does not like water","The woman likes me"]
 },
 {
	 "id": 227,
	 "label": "house",
	 "phrases": ["This is a house","I like this house"]
 },
 {
	 "id": 228,
	 "label": "sleep",
	 "phrases": ["I like to sleep","He is sleeping"]
 },
 {
	 "id": 229,
	 "label": "air",
	 "phrases": ["air","air has no color","this air is hot"]
 },
 {
	 "id": 230,
	 "label": "eat",
	 "phrases": ["I like to eat food","She is eating"]
 },
 {
	 "id": 231,
	 "label": "drink",
	 "phrases": ["You like to drink water","He is drinking water"]
 },
 {
	 "id": 232,
	 "label": "apple",
	 "phrases": ["You like to eat apples","apples are food","She does not like apples"]
 },
 {
	 "id": 233,
	 "label": "fruit",
	 "phrases": ["i like eating fruit","apples are a fruit","the fruit is not hot"]
 },
 {
	 "id": 234,
	 "label": "carrot",
	 "phrases": ["I like eating carrots","carrots are vegetables","The carrot is orange"]
 },
 {
	 "id": 235,
	 "label": "vegetable",
	 "phrases": ["Do you like eating vegetables?","apples are not vegetables","vegetables are food"]
 },
 {
	 "id": 236,
	 "label": "milk",
	 "phrases": ["Do you drink milk?","She likes drinking milk","The milk is cold"]
 },
 {
	 "id": 237,
	 "label": "rice",
	 "phrases": ["He does not like eating rice","do you eat rice?","I like to eat rice"]
 },
 {
	 "id": 238,
	 "label": "bread",
	 "phrases": ["I like bread","the bread is hot"]
 },
 {
	 "id": 239,
	 "label": "fish",
	 "phrases": ["I do not eat fish","Do you like eating fish?"]
 },
 {
	 "id": 240,
	 "label": "chicken",
	 "phrases": ["She likes eating chicken","Is this chicken?"]
 },
 {
	 "id": 241,
	 "label": "meat",
	 "phrases": ["he likes to eat meat","an apple is not meat","chicken is meat"]
 },
 {
	 "id": 242,
	 "label": "cold",
	 "phrases": ["this is not cold, this is hot","the water is cold","this house is cold"]
 },
 {
	 "id": 243,
	 "label": "shirt",
	 "phrases": ["He likes shirts","Shirts are clothes"]
 },
 {
	 "id": 244,
	 "label": "pants",
	 "phrases": ["She likes pants","Pants are clothes","Pants are not food"]
 },
 {
	 "id": 245,
	 "label": "jacket",
	 "phrases": ["You like jackets","This is a jacket"]
 },
 {
	 "id": 246,
	 "label": "dress",
	 "phrases": ["I like dresses","Dresses are clothes"]
 },
 {
	 "id": 247,
	 "label": "have",
	 "phrases": ["Do you have bread?","I have a house","She has a dress","The man has a jacket","The woman has an apple"]
 },
 {
	 "id": 248,
	 "label": "no",
	 "phrases": ["He has no dresses","I have no apples","You do not have water","The man is cold, he does not have a jacket."]
 },
 {
	 "id": 249,
	 "label": "want",
	 "phrases": ["I want an apple","Do you have carrots?","She wants this dress","I have no food, I want food.","She is cold, she wants a jacket."]
 },
 {
	 "id": 250,
	 "label": "toilet",
	 "phrases": ["The house has a toilet","This is a toilet"]
 },
 {
	 "id": 251,
	 "label": "go",
	 "phrases": ["I want to go to the toilet","He is going to the house","I want to go to her"]
 },
 {
	 "id": 252,
	 "label": "what",
	 "phrases": ["What do you like?","Do you like this?","What is this?","What does she like?","What do you want to eat?","What does he want to drink?"]
 },
 {
	 "id": 253,
	 "label": "thing",
	 "phrases": ["What is this thing?","This thing is a dress","What things do you have?","Is this thing hot?","Is this thing a fruit?"]
 },
 {
	 "id": 254,
	 "label": "Hello",
	 "phrases": ["Hello"]
 },
 {
	 "id": 255,
	 "label": "Goodbye",
	 "phrases": ["Goodbye"]
 },
 {
	 "id": 256,
	 "label": "Please",
	 "phrases": ["Can I please have water?","Please can I have chicken?"]
 },
 {
	 "id": 257,
	 "label": "Thank you",
	 "phrases": ["Thank you for the water","Thank you","Thank you for the apple"]
 },
 {
	 "id": 258,
	 "label": "Sorry",
	 "phrases": ["Sorry, I do not have carrots.","Sorry the food is cold.","I'm sorry for eating your apple."]
 },
 {
	 "id": 259,
	 "label": "Yes",
	 "phrases": ["Yes, I like eating apples."]
 },
 {
	 "id": 260,
	 "label": "Excuse me",
	 "phrases": ["Excuse me","Excuse me, can I have some carrots?"]
 },
 {
	 "id": 261,
	 "label": "red",
	 "phrases": ["The apple is red","The fruit is red"]
 },
 {
	 "id": 262,
	 "label": "blue",
	 "phrases": ["The water is blue","She has a blue dress","The fish is blue","The apple is not blue"]
 },
 {
	 "id": 263,
	 "label": "yellow",
	 "phrases": ["The house is yellow","The dress is yellow"]
 },
 {
	 "id": 264,
	 "label": "small",
	 "phrases": ["She has a small dress","The carrots are small"]
 },
 {
	 "id": 265,
	 "label": "big",
	 "phrases": ["His house is big","The apple is big"]
 },
 {
	 "id": 266,
	 "label": "good",
	 "phrases": ["The food is good","She is good","I am eating good food","This house is good"]
 },
 {
	 "id": 267,
	 "label": "bad",
	 "phrases": ["The food is bad","The man is bad","This milk is bad"]
 },
 {
	 "id": 268,
	 "label": "different",
	 "phrases": ["His shirt is different to hers","The carrots are different","I am different to you"]
 },
 {
	 "id": 269,
	 "label": "same",
	 "phrases": ["The houses are the same","The jackets are the same","I have the same dress"]
 },
 {
	 "id": 270,
	 "label": "black",
	 "phrases": ["The pants are black.","The jacket is black","The water is black"]
 },
 {
	 "id": 271,
	 "label": "white",
	 "phrases": ["He has a white shirt","The milk is white"]
 },
 {
	 "id": 272,
	 "label": "that",
	 "phrases": ["That apple is red","That shirt is big","That fish is blue"]
 },
 {
	 "id": 273,
	 "label": "color",
	 "phrases": ["What color is the apple?","What color do you like?","What color is that book?"]
 },
 {
	 "id": 274,
	 "label": "old",
	 "phrases": ["The man is old","She is old","That woman is not old"]
 },
 {
	 "id": 275,
	 "label": "young",
	 "phrases": ["The woman is young","You are young","He is young"]
 },
 {
	 "id": 276,
	 "label": "girl",
	 "phrases": ["The girl is young","The girl is eating an apple","The girl likes yellow dresses"]
 },
 {
	 "id": 277,
	 "label": "boy",
	 "phrases": ["The boy has a blue shirt","What is the boy drinking?","The man's boy is eating"]
 },
 {
	 "id": 278,
	 "label": "'s",
	 "phrases": ["The woman's shirt is red","The man's shirt is blue","That girl's dress is white","That boy's jacket is black"]
 },
 {
	 "id": 279,
	 "label": "my",
	 "phrases": ["My house is green.","My food is hot.","This shirt is mine.","That is her house."]
 },
 {
	 "id": 280,
	 "label": "your",
	 "phrases": ["Your dress is yellow.","Your house is cold.","This dress is yours.","Is this jacket yours?","Your house is white"]
 },
 {
	 "id": 281,
	 "label": "their (singular)",
	 "phrases": []
 },
 {
	 "id": 282,
	 "label": "his",
	 "phrases": ["His jacket is black","His shirt is blue"]
 },
 {
	 "id": 283,
	 "label": "her",
	 "phrases": ["Her dress is white","Her shirt is red"]
 },
 {
	 "id": 284,
	 "label": "tv",
	 "phrases": ["The tv is black","You have a tv","She has a big tv"]
 },
 {
	 "id": 285,
	 "label": "book",
	 "phrases": ["The book is blue","She has a yellow book","Do you want this book?"]
 },
 {
	 "id": 286,
	 "label": "watch",
	 "phrases": ["Does he like to watch tv?","You like watching tv","He not like watching tv","Do you want to watch tv?"]
 },
 {
	 "id": 287,
	 "label": "read",
	 "phrases": ["I am reading this book","She likes to read books","You are reading a blue book","He reads a book"]
 },
 {
	 "id": 288,
	 "label": "English",
	 "phrases": ["His English is good","This is an English book"]
 },
 {
	 "id": 289,
	 "label": "speak",
	 "phrases": ["I speak English","She does not speak English"]
 },
 {
	 "id": 290,
	 "label": "game",
	 "phrases": ["game"]
 },
 {
	 "id": 291,
	 "label": "play",
	 "phrases": ["He likes to play games","Do you like to play games?","Does she want to play a game?","I want to play"]
 },
 {
	 "id": 292,
	 "label": "music",
	 "phrases": ["This music is good"]
 },
 {
	 "id": 293,
	 "label": "listen",
	 "phrases": ["I listen to him speak English","She likes listening to music","You like to listen to music"]
 },
 {
	 "id": 294,
	 "label": "do",
	 "phrases": ["What are you doing?","What is the man doing?","What is the girl doing?","What do you want to do?"]
 },
 {
	 "id": 295,
	 "label": "here",
	 "phrases": ["I am here.","Are you here?","What is here?","My house is here.","The book is here."]
 },
 {
	 "id": 296,
	 "label": "there",
	 "phrases": ["His house is there.","The apple is there.","The tv is there."]
 },
 {
	 "id": 297,
	 "label": "where",
	 "phrases": ["Where is the book?","Where is her house?","Where are you?","Excuse me, where is the toilet?"]
 },
 {
	 "id": 298,
	 "label": "at",
	 "phrases": ["The man is at the house","The woman is at the house","I am reading at home"]
 },
 {
	 "id": 299,
	 "label": "hospital",
	 "phrases": ["The hospital is white","Where is the hospital?","You are at the hospital","He does not want to go to the hospital"]
 },
 {
	 "id": 300,
	 "label": "school",
	 "phrases": ["The boy is at school","The girl is reading books at school","She is going to school","My book is at school"]
 },
 {
	 "id": 301,
	 "label": "park",
	 "phrases": ["The park is over there","The boy is playing at the park","He is going to the park","She wants to go to the park"]
 },
 {
	 "id": 302,
	 "label": "library",
	 "phrases": ["The library has books","He is reading books at the library","Where are you going? I am going to the library. "]
 },
 {
	 "id": 303,
	 "label": "person",
	 "phrases": ["The person is a man","There is a person here","The woman is a person","There are people at the park","That girl is a person"]
 },
 {
	 "id": 304,
	 "label": "next to",
	 "phrases": ["The boy is next to the woman","The book is next to the apple","The hospital is next to the library","The school is next to the park","I am next to her"]
 },
 {
	 "id": 305,
	 "label": "know",
	 "phrases": ["He knows English","Do you know where the hospital is?","Do you know her?","Excuse me, do you know where the toilet is?","Do you know what color the book is?"]
 },
 {
	 "id": 306,
	 "label": "can",
	 "phrases": ["Can you read English?","He can drink milk","I can not drink milk","She can not go to the park","I can not eat meat","Can I have an apple?","He can not speak English"]
 },
 {
	 "id": 307,
	 "label": "see",
	 "phrases": ["Have you seen a yellow book?","I see a white dress","Do you see a blue house?","Can you see a black jacket?"]
 },
 {
	 "id": 308,
	 "label": "hear",
	 "phrases": ["Can you hear the music?","She can hear the chicken","I can hear the toilet","Do you hear the music?","Have you heard him speak English?"]
 },
 {
	 "id": 309,
	 "label": "home",
	 "phrases": ["His home is over there","Her home is white","My home is next to the park","I am at home","She is in your home"]
 },
 {
	 "id": 310,
	 "label": "room",
	 "phrases": ["The room is white","There are 3 people in the room","The room has a tv","She is in the room","He is not in the room","The room is cold","The room is hot","His home has 5 rooms"]
 },
 {
	 "id": 311,
	 "label": "kitchen",
	 "phrases": ["She is cooking in the kitchen","The eggs are in the kitchen","The kitchen is yellow","The chef is in the kitchen","The chef is cooking in the kitchen","He is eating in the kitchen","The kitchen is big","The kitchen is hot","My mom is in the kitchen","His dad is in the kitchen","Your son is going to the kitchen"]
 },
 {
	 "id": 312,
	 "label": "living room",
	 "phrases": ["The living room is small","The living room is yellow","I am watching tv in the living room"," There are 2 people in the living room","She is reading a book in the living room","Her son is in the living room","His mom is watching tv in the living room","Are you going to the living room?","Your siblings are in the living room"]
 },
 {
	 "id": 313,
	 "label": "bed",
	 "phrases": ["He is in bed","She is sleeping in bed","I am not in bed","The bed is blue","You are reading a book in bed"]
 },
 {
	 "id": 314,
	 "label": "bedroom",
	 "phrases": ["The bed is in the bedroom","The bedroom is yellow","He is in the bedroom","There are 2 people in the bedroom","The house has 3 bedrooms","Her bedroom is next to the living room","My daughter is in her bedroom","Go to your bedroom!"]
 },
 {
	 "id": 315,
	 "label": "bathroom",
	 "phrases": ["The bathroom is white","The toilet is in the bathroom","Where is the bathroom?","She is in the bathroom","I need the bathroom","The house has 2 bathrooms"]
 },
 {
	 "id": 316,
	 "label": "table",
	 "phrases": ["The living room has 2 tables","His bedroom has a table","The book is on the table","She is eating a carrot at the table","I am drinking milk at the table"]
 },
 {
	 "id": 317,
	 "label": "window",
	 "phrases": ["Please open the window","Please close the window","The window is open. It is cold.","The window is next to the table"]
 },
 {
	 "id": 318,
	 "label": "door",
	 "phrases": ["The door is next to the window","The door is white","The bathroom door is over there","I am at the door","The bed is next to the door"]
 },
 {
	 "id": 319,
	 "label": "chair",
	 "phrases": ["The chair is black","There are 6 chairs next to the table","The bedroom has 1 chair","He is on the chair","There are no chairs in the kitchen","Do you need this chair?"]
 },
 {
	 "id": 320,
	 "label": "computer",
	 "phrases": ["He has the computer","That woman took my computer","The computer is black","Her computer is on the kitchen table","Your computer is in the living room","I want to buy a computer","The computer is next to the tv"]
 },
 {
	 "id": 321,
	 "label": "charger",
	 "phrases": ["My mom needs a charger","He wants a charger","The charger is next to the computer","Your charger is on the table","Her charger is in the kitchen","The charger is white","The charger is in my pants","I need to buy a charger"]
 },
 {
	 "id": 322,
	 "label": "use",
	 "phrases": ["She is using the charger","I am using the computer","He is using the toilet","I need to use the toilet","The chef is using the kitchen","Do you want to use the computer?","I am using the tv","The student is using a computer"]
 },
 {
	 "id": 323,
	 "label": "happy",
	 "phrases": ["It is good to be happy","Eating this makes me happy","I am happy when I eat apples","What makes you happy?","My younger brother is happy"]
 },
 {
	 "id": 324,
	 "label": "sad",
	 "phrases": ["Are you sad?","He lost his book. He is sad.","The girl can not find her mom. She is sad.","His older sister is sad"]
 },
 {
	 "id": 325,
	 "label": "angry",
	 "phrases": ["The bus is not here. That man is angry.","Her wallet was taken. She is angry.","The airport lost my luggage. I am angry.","Are you angry?","Watching this makes me angry","Your dad is angry"]
 },
 {
	 "id": 326,
	 "label": "scared",
	 "phrases": ["She does not like chickens. She is scared of chickens.","The man is scared of going to the hospital.","He is not scared of going to America","She is scared of the police","He is not scared of the police","Her younger sister is scared"]
 },
 {
	 "id": 327,
	 "label": "feel",
	 "phrases": ["I feel bad. I need to go to the hospital.","He feels scared","She felt angry","Do you feel happy?","Reading this book makes me feel sad","How does your older brother feel?"]
 },
 {
	 "id": 328,
	 "label": "feeling",
	 "phrases": ["How are you feeling?","What are you feeling?"]
 },
 {
	 "id": 329,
	 "label": "friend",
	 "phrases": ["He is my friend","My friend likes eating red apples","Does your friend like to watch tv?"]
 },
 {
	 "id": 330,
	 "label": "girlfriend",
	 "phrases": ["My girlfriend likes green dresses","His girlfriend is a doctor","Your girlfriend is at the restaurant"]
 },
 {
	 "id": 331,
	 "label": "boyfriend",
	 "phrases": ["My boyfriend likes to play in the park","Her boyfriend is a firefighter","Is your boyfriend home?"]
 },
 {
	 "id": 332,
	 "label": "wife",
	 "phrases": ["His wife is wearing a white dress","His wife is at home","His wife is reading a book","Is she your wife?","That woman is my wife"]
 },
 {
	 "id": 333,
	 "label": "husband",
	 "phrases": ["Her husband is wearing a black jacket","Her husband is at work","Her husband is watching tv","Is he your husband?","That man is my husband"]
 },
 {
	 "id": 334,
	 "label": "partner",
	 "phrases": ["Is that your partner?","He is my partner","She is my partner","My partner likes to go to the library","Where is your partner?","Do you have a partner?"]
 },
 {
	 "id": 335,
	 "label": "it (entity)",
	 "phrases": ["The fish is over there. It is blue.","I can not find my shirt. It is blue.","The dog over there. It is running to the park."]
 },
 {
	 "id": 336,
	 "label": "we",
	 "phrases": ["I like apples. You like bananas. We like fruit.","We like to eat at restaurants","We are going to school","Where are we?"]
 },
 {
	 "id": 337,
	 "label": "they",
	 "phrases": ["My son and daughter like the park. They are playing at the park.","They need to go to the hospital","My mom and dad are at work. They are doctors."]
 },
 {
	 "id": 338,
	 "label": "its (entity)",
	 "phrases": ["The fish is here. Its eyes are white.","The chicken is there. Its head is red.","My house is big. Its door is big and blue."]
 },
 {
	 "id": 339,
	 "label": "our",
	 "phrases": ["Our house is small","Our children are young","Excuse me, our food is cold."]
 },
 {
	 "id": 340,
	 "label": "their",
	 "phrases": ["Their school is next to the park","Their books are on the table","My mom and dad are chefs. Their car is big. "]
 },
 {
	 "id": 355,
	 "label": "grocery store",
	 "phrases": ["Are you going to the grocery store?","Can you buy some milk at the grocery store?","The grocery store has apples"]
 },
 {
	 "id": 356,
	 "label": "grocery",
	 "phrases": ["This bag has groceries","I bought groceries at the grocery store","What groceries did you buy?"]
 },
 {
	 "id": 357,
	 "label": "bakery",
	 "phrases": ["This bakery sells good bread","Where is the bakery?","I am buying bread at the bakery"]
 },
 {
	 "id": 358,
	 "label": "church",
	 "phrases": ["He goes to church on Sundays","Are you at church?","The church is white"]
 },
 {
	 "id": 359,
	 "label": "shop",
	 "phrases": ["The shop is next to the school","This shop sells meat","There are 3 small shops next to the library"]
 },
 {
	 "id": 360,
	 "label": "to shop",
	 "phrases": ["He is shopping for vegetables at the shop","Where do you go to shop?","She is shopping for good meat","I am shopping for fruits today"]
 },
 {
	 "id": 361,
	 "label": "cart",
	 "phrases": ["Does this supermarket have shopping carts?","His shopping cart has 30 fruits","There is a shopping cart in the park"]
 },
 {
	 "id": 362,
	 "label": "basket",
	 "phrases": ["She has 4 apples in her basket","Where are the shopping baskets?","I need a shopping basket","He has 9 carrots in his basket"]
 },
 {
	 "id": 363,
	 "label": "expire",
	 "phrases": ["The milk is bad. It has expired.","Do not drink the expired milk","Can I drink this milk? Has it expired?"]
 },
 {
	 "id": 364,
	 "label": "money",
	 "phrases": ["The money is green","The ATM has money","She needs money","He is getting money from work","My wallet has money"]
 },
 {
	 "id": 365,
	 "label": "cheap",
	 "phrases": ["This restaurant is cheap!","These carrots are cheap","This book is cheap"]
 },
 {
	 "id": 366,
	 "label": "expensive",
	 "phrases": ["This restaurant is expensive!","Her plane ticket was expensive","His tv is big. It was expensive."]
 },
 {
	 "id": 367,
	 "label": "pay",
	 "phrases": ["Where do I pay?","You can pay over there","He is paying for her food","My dad is paying for my food"]
 },
 {
	 "id": 368,
	 "label": "sell",
	 "phrases": ["What does this store sell?","Does this store sell tvs?","Does this store sell books?","He sold me a cheap book","She wants to sell her house"]
 },
 {
	 "id": 369,
	 "label": "bag",
	 "phrases": ["Do you want a bag?","Have you seen my red bag?","I lost my bag","The bag has vegetables in it"]
 },
 {
	 "id": 370,
	 "label": "gift",
	 "phrases": ["Where can I buy a gift for my son?","I need to buy a gift for my daughter","Is this book a good gift?"]
 },
 {
	 "id": 371,
	 "label": "shorts",
	 "phrases": ["He is wearing black shorts","She is wearing red shorts","There is a man with red shorts on the beach"]
 },
 {
	 "id": 372,
	 "label": "shoe",
	 "phrases": ["He has white shoes","She likes her red shoes","Have you seen a small blue shoe?","You need to wear black shoes"]
 },
 {
	 "id": 373,
	 "label": "underwear",
	 "phrases": ["My underwear is white","Does this store have black underwear?","I need to buy some white underwear"]
 },
 {
	 "id": 374,
	 "label": "hat",
	 "phrases": ["He has a blue hat","She is wearing a big hat","Have you seen a green hat?","My younger brother is wearing a white hat"]
 },
 {
	 "id": 375,
	 "label": "skirt",
	 "phrases": ["She is wearing a black skirt and a blue shirt","My daughter wants to find a small red skirt","That woman is buying a green skirt"]
 },
 {
	 "id": 376,
	 "label": "coat",
	 "phrases": ["The doctor is wearing a white coat","The scientist has a big white coat","He has a long black coat"]
 },
 {
	 "id": 377,
	 "label": "umbrella",
	 "phrases": ["Do I need an umbrella today?","She has a yellow umbrella","I need to buy an umbrella"]
 },
 {
	 "id": 378,
	 "label": "jeans",
	 "phrases": ["Jeans are blue","The farmer is wearing jeans","She is buying jeans at the clothing store"]
 },
 {
	 "id": 419,
	 "label": "gym",
	 "phrases": ["I like to go to the gym","She is at the gym","He is running at the gym","You are playing basketball at the gym","The man is drinking water at the gym","Does the gym have a toilet?"]
 },
 {
	 "id": 420,
	 "label": "ball",
	 "phrases": ["The ball is red","He is playing with a ball","The ball is in the park","She has a beach ball"]
 },
 {
	 "id": 421,
	 "label": "basketball",
	 "phrases": ["He likes playing basketball","When are you playing basketball?","I am playing basketball now","She likes playing basketball","You are playing basketball at the park","Did you buy a basketball?","Who has the basketball?","Are you good at playing basketball?"]
 },
 {
	 "id": 422,
	 "label": "soccer",
	 "phrases": ["I like playing soccer","My daughter wants to play soccer","Is he playing soccer?","You are good at playing soccer"]
 },
 {
	 "id": 423,
	 "label": "soccer ball",
	 "phrases": ["The soccer ball is white","The soccer ball is over there","Do you have the soccer ball?","She has the soccer ball","I bought a soccer ball"]
 },
 {
	 "id": 424,
	 "label": "football",
	 "phrases": ["Americans like to play football","The American is good at playing football","He likes to play American football"]
 },
 {
	 "id": 425,
	 "label": "tennis",
	 "phrases": ["He and she are playing tennis","My mom does not like playing tennis","Do you want to play tennis with me today?"]
 },
 {
	 "id": 426,
	 "label": "cricket ball",
	 "phrases": ["The cricket ball is red","Where is the cricket ball?","Who has the cricket ball?","The cricket ball is here","She is good at playing cricket"]
 },
 {
	 "id": 427,
	 "label": "baseball",
	 "phrases": ["Do you like to play baseball?","Her son likes to play baseball","I am playing baseball","Japan is good at baseball","He is good at playing baseball"]
 },
 {
	 "id": 428,
	 "label": "swim",
	 "phrases": ["I like swimming","She is swimming in the lake","He does not like to swim","Are you going to the lake to swim?","Where is there water? I want to go swim.","He can swim","I do not know how to swim"]
 },
 {
	 "id": 429,
	 "label": "jump",
	 "phrases": ["He can jump","She can jump. She is good at playing basketball.","I jumped on the bed","You can not jump in this room"]
 },
 {
	 "id": 430,
	 "label": "throw",
	 "phrases": ["He threw the cricket ball","She threw the basketball","Are you good at throwing baseballs?","He is bad at throwing baseballs","Please make a good throw"]
 },
 {
	 "id": 431,
	 "label": "catch",
	 "phrases": ["Can you catch baseballs?","I am good at catching cricket balls","She caught that ball","Please catch the ball"]
 },
 {
	 "id": 432,
	 "label": "kick",
	 "phrases": ["He is good at kicking. He likes playing soccer.","She likes kicking soccer balls","I kicked the ball. The ball went into the house."]
 },
 {
	 "id": 433,
	 "label": "run",
	 "phrases": ["You can not run in the library","She likes to run","He likes running. He is good at playing soccer.","I am running to school"]
 },
 {
	 "id": 434,
	 "label": "team",
	 "phrases": ["There are 5 people on the basketball team","He is in the baseball team","There are 9 people in the school's baseball team","There are 11 people on the Cricket team","I like my team","She is on the basketball team","The blue team is good","He is on the yellow team"]
 },
 {
	 "id": 435,
	 "label": "win",
	 "phrases": ["The yellow team won","The blue team is winning","She won the game","My school won the game"]
 },
 {
	 "id": 436,
	 "label": "lose",
	 "phrases": ["The red team lost","The yellow team is losing","He lost the game","Her school lost the game"]
 },
 {
	 "id": 437,
	 "label": "stadium",
	 "phrases": ["The game is at the stadium","Where is the stadium?"]
 },
 {
	 "id": 438,
	 "label": "nurse",
	 "phrases": ["The nurse works at a hospital","The nurse likes to help people","That nurse is helping a man","Do you know where the nurse is?","The nurse saved him","She is a nurse","He is a nurse"]
 },
 {
	 "id": 439,
	 "label": "pills",
	 "phrases": ["Do you know where my pills are?","The pills are yellow","His pills are red","He ate white pills"]
 },
 {
	 "id": 440,
	 "label": "health",
	 "phrases": ["He is in good health","Are you in good health?","How is your health?","Her health is bad"]
 },
 {
	 "id": 441,
	 "label": "healthy",
	 "phrases": ["She is healthy","He is not healthy","Are you healthy?","The doctor made me healthy.","You are young. You are healthy.","Is your mom healthy?"]
 },
 {
	 "id": 442,
	 "label": "eye",
	 "phrases": ["His eyes are blue","You have two eyes","She has big eyes","He has small eyes"]
 },
 {
	 "id": 443,
	 "label": "ear",
	 "phrases": ["You have two ears","He has small ears","She has big ears"]
 },
 {
	 "id": 444,
	 "label": "hand",
	 "phrases": ["You have two hands","He has big hands","She has small hands","The doctor has small hands"]
 },
 {
	 "id": 445,
	 "label": "foot",
	 "phrases": ["You have two feet","She has small feet","He has big feet"]
 },
 {
	 "id": 446,
	 "label": "arm",
	 "phrases": ["He has long arms","You have 2 arms"]
 },
 {
	 "id": 447,
	 "label": "leg",
	 "phrases": ["I have 2 legs","She has long legs"]
 },
 {
	 "id": 448,
	 "label": "hair",
	 "phrases": ["Her hair is yellow","His hair is red"]
 },
 {
	 "id": 449,
	 "label": "nose",
	 "phrases": ["He has a big nose","She has a small nose"]
 },
 {
	 "id": 450,
	 "label": "mouth",
	 "phrases": ["He has a big mouth","That woman has a small mouth"]
 },
 {
	 "id": 451,
	 "label": "tooth",
	 "phrases": ["His teeth are white","That man's teeth are not good. His teeth are yellow.","You have 32 teeth"]
 },
 {
	 "id": 452,
	 "label": "body",
	 "phrases": ["That man has a big body","I have a small body","She has a big body"]
 },
 {
	 "id": 453,
	 "label": "pretty",
	 "phrases": ["That woman has pretty hands","She has pretty hair","He has pretty eyes"]
 },
 {
	 "id": 454,
	 "label": "face",
	 "phrases": ["She has a pretty face","The teacher has a pretty face","The doctor has a pretty face","Your face is pretty"]
 },
 {
	 "id": 455,
	 "label": "head",
	 "phrases": ["The man has a big head","Her head is small"]
 },
 {
	 "id": 459,
	 "label": "sun",
	 "phrases": ["The sun is big","the sun is yellow","Can you see the sun?"]
 },
 {
	 "id": 460,
	 "label": "moon",
	 "phrases": ["The moon is white","the moon is big","I see the moon","She is watching the moon"]
 },
 {
	 "id": 461,
	 "label": "tree",
	 "phrases": ["The tree is green","The tree is big"]
 },
 {
	 "id": 462,
	 "label": "ground",
	 "phrases": ["He is on the ground","The chicken is on the ground"]
 },
 {
	 "id": 463,
	 "label": "wood",
	 "phrases": ["The tree has wood","The wood is big"]
 },
 {
	 "id": 464,
	 "label": "flower",
	 "phrases": ["The flower is pretty","She has a flower","The flower is yellow"]
 },
 {
	 "id": 465,
	 "label": "gold",
	 "phrases": ["Gold is yellow","This mountain has gold","He found gold in the water"]
 },
 {
	 "id": 466,
	 "label": "ocean",
	 "phrases": ["The ocean is big","The ocean is blue","He is on the ocean","Is the beach next to the ocean?"]
 },
 {
	 "id": 467,
	 "label": "dog",
	 "phrases": ["The dog is white","The dog is small","He has a black dog","I have a big dog"]
 },
 {
	 "id": 468,
	 "label": "cat",
	 "phrases": ["She has a small cat","The cat is yellow","His cat is white","The cat is drinking water"]
 },
 {
	 "id": 469,
	 "label": "bird",
	 "phrases": ["There are birds in the park","The bird is next to the apple","He has a green bird"]
 },
 {
	 "id": 470,
	 "label": "animal",
	 "phrases": ["What animal is this?","Birds are animals","Dogs are good animals","Cats are animals"]
 },
 {
	 "id": 471,
	 "label": "cow",
	 "phrases": ["Cows are big","There are 11 cows on the farm","Does this farm have any cows?","The cow is white"]
 },
 {
	 "id": 472,
	 "label": "pig",
	 "phrases": ["This farm has 6 pigs","Do you like pigs?","The pig is big"]
 },
 {
	 "id": 473,
	 "label": "boat",
	 "phrases": ["The boat is on the water","The ferry is a boat","The fisherman is on the boat","There are 30 fish underneath the boat"]
 },
 {
	 "id": 474,
	 "label": "entrance",
	 "phrases": ["Where is the entrance to the hospital?","Excuse me, do you know where the entrance to the park is?","She went to the entrance","That woman is next to the entrance"]
 },
 {
	 "id": 475,
	 "label": "enter",
	 "phrases": ["He entered the library","The doctor entered the hospital","The girl entered the school","He can not enter the building"]
 },
 {
	 "id": 476,
	 "label": "exit",
	 "phrases": ["Excuse me, where is the exit?","The museum's exit is over there","He went to the exit","That green door is the exit","The toilet is next to the exit"]
 },
 {
	 "id": 477,
	 "label": "to exit",
	 "phrases": ["She exited the airport","The student exited the school","He exited the park","The boy exited the train station"]
 },
 {
	 "id": 478,
	 "label": "internet",
	 "phrases": ["Do you have internet at home?","Can you get internet at the store?","You can get internet at the library","Where can I get internet?"]
 },
 {
	 "id": 479,
	 "label": "in front",
	 "phrases": ["The hospital is in front of you","the toilet is in front of the store","he is in front of her"]
 },
 {
	 "id": 480,
	 "label": "front",
	 "phrases": ["He was at the front of the class","The train driver is at the front of the train","The pilot is at the front of the plane"]
 },
 {
	 "id": 481,
	 "label": "back",
	 "phrases": ["The old books are at the back of the library","The back window is open","She is sitting at the back of the class"]
 },
 {
	 "id": 482,
	 "label": "behind",
	 "phrases": ["She is behind him","the park is behind you","the book is behind the tv"]
 },
 {
	 "id": 483,
	 "label": "bridge",
	 "phrases": ["The bridge is red","There are people walking on the bridge","Are there cars on the bridge?","Where does this bridge go?"]
 },
 {
	 "id": 484,
	 "label": "below",
	 "phrases": ["The book is below the tv","The shop is below the house","The lake is below the bird"]
 },
 {
	 "id": 485,
	 "label": "under",
	 "phrases": ["He swam under the bridge","She ran under the bridge","I like to walk under the bridge"]
 },
 {
	 "id": 486,
	 "label": "underneath",
	 "phrases": ["The bed is underneath him","The book is underneath the apple","The platform is underneath her","We are underneath the sun"]
 },
 {
	 "id": 487,
	 "label": "above",
	 "phrases": ["The TV is above the table","The boat is above the water","The sun is above us","His house is above the shop","The bird is above the lake"]
 },
 {
	 "id": 488,
	 "label": "over",
	 "phrases": ["She jumped over the table","He is walking over the lake","They walked over the mountain","I like walking over the bridge","Do you want to walk over the bridge?"]
 },
 {
	 "id": 489,
	 "label": "on top",
	 "phrases": ["The book is on top of the table","The bike is on top of the platform","The boat is on top of the water","He is on top of the bed"]
 },
 {
	 "id": 490,
	 "label": "near",
	 "phrases": ["The apple is near the book","The school is near the park","He is eating near the house","The hospital is near the supermarket"]
 },
 {
	 "id": 491,
	 "label": "far",
	 "phrases": ["The sun is far","My country is far","America is far from India","His mom is far from home"]
 },
 {
	 "id": 492,
	 "label": "out",
	 "phrases": ["The girl went outside to play","The boy is outside the house","I want to go outside","Mom threw out his clothes","He went out to play"]
 },
 {
	 "id": 493,
	 "label": "between",
	 "phrases": ["He is between his mom and his dad","The apple is between the books","The grocery store is between the pharmacy and the school"]
 },
 {
	 "id": 494,
	 "label": "middle",
	 "phrases": ["The boy is in the middle of the park","The table is in the middle of the living room","He is in the middle of the house","The book is in the middle of the table"]
 },
 {
	 "id": 495,
	 "label": "weekend",
	 "phrases": ["What are you doing this weekend?","I am going to Japan this weekend","She is going to her dad's house this weekend","Did you have a good weekend?"]
 },
 {
	 "id": 496,
	 "label": "week",
	 "phrases": ["What are you doing this week?","I need to go to school this week","She does not need to go to school this week","I want to go to the beach this week"]
 },
 {
	 "id": 497,
	 "label": "month",
	 "phrases": ["What month is it?","There are 28 to 31 days in a month","Is it hot this month?","It is cold this month"]
 },
 {
	 "id": 498,
	 "label": "year",
	 "phrases": ["What year is this?","The year is 2099","I do not have to go to school this year","This is a good year"]
 },
 {
	 "id": 499,
	 "label": "tomorrow",
	 "phrases": ["Are you going to school tomorrow?","Do you want to play in the park tomorrow?","I need to go to the pharmacy tomorrow"]
 },
 {
	 "id": 500,
	 "label": "yesterday",
	 "phrases": ["What did you do yesterday?","Yesterday I went to the library","Did you like going to school yesterday?"]
 },
 {
	 "id": 501,
	 "label": "available",
	 "phrases": ["Are you available on Sunday?","The doctor is available on Monday, Tuesday, and Wednesday","She is not available on Thursday and Friday","I am available at 3:15 pm","Is he available on Thursday?"]
 },
 {
	 "id": 502,
	 "label": "busy",
	 "phrases": ["I am busy at 12:45 pm","Are you busy on Saturday?","I am busy on Wednesday"]
 },
 {
	 "id": 543,
	 "label": "banana",
	 "phrases": ["The banana is yellow","He is eating a banana","She does not like eating bananas"]
 },
 {
	 "id": 544,
	 "label": "strawberry",
	 "phrases": ["The strawberry is red","She wants a strawberry","I like eating strawberries","Strawberries are a small red fruit"]
 },
 {
	 "id": 545,
	 "label": "orange",
	 "phrases": []
 },
 {
	 "id": 546,
	 "label": "orange (color)",
	 "phrases": ["The book is orange","He likes the color orange","The firefighter has an orange jacket"]
 },
 {
	 "id": 547,
	 "label": "oranges (fruit)",
	 "phrases": ["Do you like eating oranges?","He is eating an orange","My mom likes to eat oranges","His son does not like eating oranges","Oranges are a fruit"]
 },
 {
	 "id": 548,
	 "label": "watermelon",
	 "phrases": ["The watermelon is green","I like eating watermelon","The watermelon is big","She has a big watermelon","The fruit store has 30 watermelons"]
 },
 {
	 "id": 549,
	 "label": "lemon",
	 "phrases": ["The lemons are yellow","This store does not have lemons","She is eating a lemon","The lemon is small"]
 },
 {
	 "id": 550,
	 "label": "slice",
	 "phrases": ["I want 4 slices of watermelon","Do you want a slice of watermelon?","There are 2 slices of lemon on the fish","The chef is slicing an orange"]
 },
 {
	 "id": 551,
	 "label": "tomato",
	 "phrases": ["Tomatoes are a big red vegetable","He likes eating tomatoes","There are tomatoes in the food"]
 },
 {
	 "id": 552,
	 "label": "mushroom",
	 "phrases": ["The mushroom is red","Do not eat this mushroom","You can eat this mushroom","I like to eat mushrooms","The park has mushrooms"]
 },
 {
	 "id": 553,
	 "label": "broccoli",
	 "phrases": ["My son does not like to eat broccoli","The broccoli is green","There is broccoli in the food"]
 },
 {
	 "id": 554,
	 "label": "potato",
	 "phrases": ["The farm has potatoes","He likes to eat potatoes","I do not like eating potatoes"]
 },
 {
	 "id": 555,
	 "label": "drink (noun)",
	 "phrases": ["What drink are you drinking?","What drink do you want?","This drink is milk","What is that white drink?"]
 },
 {
	 "id": 556,
	 "label": "juice",
	 "phrases": ["The student is drinking apple juice","She is drinking juice at school","The boy is drinking a juice at the park","The juice is cold"]
 },
 {
	 "id": 557,
	 "label": "tea",
	 "phrases": ["The tea is hot","India has good tea","Japan has good tea","Do you like Japanese tea?","She wants to drink tea","My dad is drinking tea"]
 },
 {
	 "id": 558,
	 "label": "coffee",
	 "phrases": ["The coffee is hot","I do not drink coffee","She likes drinking coffee","The doctor is drinking coffee"]
 },
 {
	 "id": 559,
	 "label": "cup",
	 "phrases": ["I want a cup of water","Can I please have a cup of water?","She is drinking a cup of tea","Do you need a cup of coffee?"]
 },
 {
	 "id": 560,
	 "label": "beef",
	 "phrases": ["He likes eating beef","She does not eat beef","My dad does not eat beef","He is cooking beef"]
 },
 {
	 "id": 561,
	 "label": "pork",
	 "phrases": ["I do not eat pork","The chef is cooking pork","My mom does not eat pork","Can you eat pork?"]
 },
 {
	 "id": 562,
	 "label": "egg",
	 "phrases": ["I like eating eggs","The egg is white","There are 12 eggs here","My mom is cooking eggs"]
 },
 {
	 "id": 563,
	 "label": "piece",
	 "phrases": ["There are 3 pieces of egg","I want a piece of beef","She took a piece of pork","There are 7 pieces of pork"]
 },
 {
	 "id": 564,
	 "label": "cut",
	 "phrases": ["He cut the meat into small pieces","She cut her hair","I hurt my hand cutting an apple"]
 },
 {
	 "id": 565,
	 "label": "noodle",
	 "phrases": ["The noodles are yellow","Do you like eating noodles?","Japan has good noodles","Is that noodle store good?"]
 },
 {
	 "id": 566,
	 "label": "burger",
	 "phrases": ["I like burgers","America has good burgers","Do you want to eat burgers?"]
 },
 {
	 "id": 567,
	 "label": "dumpling",
	 "phrases": ["Japan has good dumplings","I like eating dumplings","The dumplings are yellow"]
 },
 {
	 "id": 585,
	 "label": "photograph",
	 "phrases": ["Are you good at photographing people?","He is photographing her","She likes to photograph the moon"]
 },
 {
	 "id": 586,
	 "label": "photo",
	 "phrases": ["Her photographs are good","Can you please take a photograph of me?","He likes to take photographs","This is a good photo of him"]
 },
 {
	 "id": 587,
	 "label": "photographer",
	 "phrases": ["He is a photographer","The photographer is photographing that woman","The photographer is photographing the chef's food"]
 },
 {
	 "id": 588,
	 "label": "learn",
	 "phrases": ["He is learning how to read English","She is learning how to speak Hindi","Are you learning Japanese?","The boy is learning at that school"]
 },
 {
	 "id": 589,
	 "label": "teach",
	 "phrases": ["She teaches at this school","Does this school teach Japanese?","He is teaching us French","I like to teach students how to draw"]
 },
 {
	 "id": 590,
	 "label": "art",
	 "phrases": ["The museum has good art","She can make good art","He likes art","This art is not bad"]
 },
 {
	 "id": 591,
	 "label": "sing",
	 "phrases": ["She likes to sing in the bathroom","He is singing to her","I like to sing"]
 },
 {
	 "id": 592,
	 "label": "singer",
	 "phrases": ["She is a singer","He likes watching that singer","The singer is on tv","The singer has green hair"]
 },
 {
	 "id": 593,
	 "label": "song",
	 "phrases": ["This song is good","The singer made a good song","Do you like this song?"]
 },
 {
	 "id": 594,
	 "label": "karaoke",
	 "phrases": ["Do you want to go sing karaoke?","I want to go sing songs at karaoke"]
 },
 {
	 "id": 595,
	 "label": "bar",
	 "phrases": ["Do you want to go to a bar?","Does the bar have food?","The bar has drinks"]
 },
 {
	 "id": 596,
	 "label": "karaoke bar",
	 "phrases": ["They are singing at a karaoke bar","The karaoke bar is big"]
 },
 {
	 "id": 597,
	 "label": "guitar",
	 "phrases": ["He is teachers students how to play the guitar","He likes playing the guitar","She is not bad at playing the guitar","He is playing a song on the guitar"]
 },
 {
	 "id": 598,
	 "label": "piano",
	 "phrases": ["She is good at playing the piano","Do you know how to play the piano?","I want to learn how to play the piano","My daughter is playing a song on the piano"]
 },
 {
	 "id": 599,
	 "label": "drive",
	 "phrases": ["He is driving to the hospital","She is driving a blue car","That man is driving a big yellow bus","Do you want to drive the car?","I do not want to drive this car"]
 },
 {
	 "id": 600,
	 "label": "driver",
	 "phrases": ["I work as a train driver","That woman is a bus driver","Where is the taxi driver?","The taxi driver is young"]
 },
 {
	 "id": 601,
	 "label": "cinema",
	 "phrases": ["I want to go to the cinemas","Do you want to go to the cinemas with me?","This cinema is big","This cinema has 8 movies","He likes to watch movies at the cinema"]
 },
 {
	 "id": 602,
	 "label": "boardgame",
	 "phrases": ["Do you like to play boardgames?","She does not like to play boardgames","The boardgame is big","He is playing a boardgame with his mom and younger brother"]
 },
 {
	 "id": 603,
	 "label": "video game",
	 "phrases": ["In this video game you catch bad people","this video game is good","Do you want to play a video game?","He plays video games at home","She is playing a video game with her friend"]
 },
 {
	 "id": 604,
	 "label": "to fish",
	 "phrases": ["I like to fish at the beach","That man on the boat is fishing","He is fishing on the lake"]
 },
 {
	 "id": 605,
	 "label": "fisherman",
	 "phrases": ["The fisherman caught 8 fishes","That man is a fisherman","The fisherman is next to the boat"]
 },
 {
	 "id": 606,
	 "label": "meet",
	 "phrases": ["He met her at the library","I need to meet you","She will meet me at the park","My dad met my mom in France","I will meet you at the office"]
 },
 {
	 "id": 607,
	 "label": "of",
	 "phrases": ["Do you want a slice of apple?","He is eating a piece of beef","I want a cup of orange juice","Is that a cup of apple juice?","There is a cup of milk in the middle of the table","Two of the books are open","It is cold. One of the windows is open.","7 of the students are boys"]
 },
 {
	 "id": 608,
	 "label": "to",
	 "phrases": ["Do you want to go to school?","I am going to India","It is time to go to bed"]
 },
 {
	 "id": 609,
	 "label": "for",
	 "phrases": ["Thank you for the milk","I'm sorry for not going to school","She is waiting for the train","The hospital is east of the clothing store","He is calling for help","I am shopping for clothes","My son is paying for my food","I need to find a gift for my mom"]
 },
 {
	 "id": 610,
	 "label": "with",
	 "phrases": ["Who is the boy with the blue jacket?","I like going to the cinemas with you","He is playing basketball with his older brother","She is shopping for dresses with her younger sister"]
 },
 {
	 "id": 611,
	 "label": "and",
	 "phrases": ["I like to eat apples and carrots","He likes going to school and to the park","She is wearing a red dress and red shoes","My younger brother is on a yellow and blue boat","The police car is white and blue","The firetruck is red and yellow"]
 },
 {
	 "id": 612,
	 "label": "than",
	 "phrases": []
 },
 {
	 "id": 613,
	 "label": "-er",
	 "phrases": ["Is he younger than you?","His apple is bigger than mine","India is hotter than Japan"]
 },
 {
	 "id": 614,
	 "label": "more",
	 "phrases": ["She has more books than him","Can I please have more water?","You have more cars than him","I want more food","My older sister knows more English than me"]
 },
 {
	 "id": 615,
	 "label": "-est",
	 "phrases": ["My son is the youngest","His dad is the oldest","This water is the hottest","Her tv is the biggest","Her school is the smallest","He has the biggest head"]
 },
 {
	 "id": 616,
	 "label": "most",
	 "phrases": ["She has the biggest library. She has the most books.","He has the biggest tv. He watches the most movies.","She has a the most jackets. She is the coldest.","What do you like the most?"]
 },
 {
	 "id": 617,
	 "label": "less",
	 "phrases": ["I have less houses than him","He has less books than her","I want less rice"]
 },
 {
	 "id": 618,
	 "label": "least",
	 "phrases": ["What do you like the least?","She has the least food","I am the least angry"]
 },
 {
	 "id": 619,
	 "label": "very",
	 "phrases": ["Northern Japan is very cold","India is very hot","The chef's food is very good!","She lost her book. She is very sad."]
 },
 {
	 "id": 620,
	 "label": "much",
	 "phrases": ["I don't have much time to go to school","Do you know much Hindi?"," How much money do you need?","How much is this dress?","The tea does not have much milk"]
 },
 {
	 "id": 621,
	 "label": "little",
	 "phrases": ["The little boy was lost in the park","There is little water in this cup","A little knowledge of English is good","You should know a little Hindi when you are in India","I learnt a little bit of Japanese in Japan","He needs very little money"]
 },
 {
	 "id": 622,
	 "label": "green",
	 "phrases": ["The apple is green","The teacher has a green book","The park is green","What color is the apple? It is green."]
 },
 {
	 "id": 623,
	 "label": "give",
	 "phrases": ["Can you give me an apple?","He gave me his tv","I want to give her this flower"]
 },
 {
	 "id": 624,
	 "label": "to gift",
	 "phrases": ["He gifted me a tv","She gifted me a book","The doctor gifted the school a lot of money","The woman gifted the man a shirt"]
 },
 {
	 "id": 625,
	 "label": "get",
	 "phrases": ["She needs to get a new shirt","He needs to get some food","I need to get her a gift","He got $500 from the hospital","Did you get my gift?","My son got a book from his teacher"]
 },
 {
	 "id": 626,
	 "label": "receive",
	 "phrases": ["He received many apples from the farmer","She received many flowers today","My dad was happy to receive my gift"]
 },
 {
	 "id": 627,
	 "label": "BATH",
	 "phrases": ["She wants to take a long bath","He likes taking hot baths","I like to take baths with hot water","That man is dirty. He needs a bath."]
 },
 {
	 "id": 628,
	 "label": "SHOWER",
	 "phrases": ["He likes taking long showers","He is taking a cold shower","She wants to take a hot shower"]
 },
 {
	 "id": 629,
	 "label": "CLOCK",
	 "phrases": ["There is a big white clock above the tv","He has a small red clock next to his bed","The time on the clock is wrong"]
 },
 {
	 "id": 630,
	 "label": "NEWSPAPER",
	 "phrases": ["The newspaper has bad news","Is there good news in the newspaper?","The library has old newspapers","My dad likes reading the newspaper in the morning"]
 },
 {
	 "id": 631,
	 "label": "NEWS",
	 "phrases": ["My mom is in the news","Do you have any good news from the hospital?","The news from the hospital is not good"]
 },
 {
	 "id": 632,
	 "label": "DESK",
	 "phrases": ["He is sitting at his desk","Her phone and computer are on her desk","Your dad is working at his desk"]
 },
 {
	 "id": 633,
	 "label": "DICTIONARY",
	 "phrases": ["Have you seen my Japanese dictionary?","I need to buy a French dictionary"]
 },
 {
	 "id": 634,
	 "label": "NOTE",
	 "phrases": ["He made a note that he needed to buy milk","The student made a note in the book","I gave her a note telling her where to go"]
 },
 {
	 "id": 635,
	 "label": "HOMEWORK",
	 "phrases": ["After school, he goes home and does homework","She wants to play in the park. She is bad at doing homework.","My son is doing homework in his room."]
 },
 {
	 "id": 636,
	 "label": "MAGAZINE",
	 "phrases": ["This magazine has lots of pictures about clothes","He likes reading magazines about cars","Do you want to read this magazine?"]
 },
 {
	 "id": 637,
	 "label": "PAGE",
	 "phrases": ["He read the page quickly","She is on the second page of the book","Please go to page 15 of your book"]
 },
 {
	 "id": 638,
	 "label": "PAPER",
	 "phrases": ["The paper is white","Do you have any paper I can write on?","The paper has information about the school"]
 },
 {
	 "id": 639,
	 "label": "PEN",
	 "phrases": ["He is writing with a blue pen","Do you have a red pen I can use?","I need to buy a black pen"]
 },
 {
	 "id": 640,
	 "label": "PENCIL",
	 "phrases": ["She is drawing with a green pencil","Do you have a red pencil I can use?","He needs to buy pencils for school"]
 },
 {
	 "id": 641,
	 "label": "RADIO",
	 "phrases": ["What are you listening to on the radio?","The radio is playing a good song","She likes listening to the radio in the evening"]
 },
 {
	 "id": 642,
	 "label": "BOX",
	 "phrases": ["What is inside the box?","The cat is playing inside the box","His clothes are inside the box","The box is big and heavy","There are good books in that box"]
 },
 {
	 "id": 643,
	 "label": "CAMERA",
	 "phrases": ["The photographer has a big camera","Have you seen my camera?","Your camera is in your bag"]
 },
 {
	 "id": 644,
	 "label": "PICTURE",
	 "phrases": ["This is a picture of my mom and dad","He has a picture of his daughter on the table","She has a picture of a lake above the tv"]
 },
 {
	 "id": 645,
	 "label": "PAINTING",
	 "phrases": ["This is a painting of a mountain","His painting of the boat is good","In France, there are a lot of people who go and look at a painting of a woman"]
 },
 {
	 "id": 646,
	 "label": "PAINT",
	 "phrases": ["Can you paint me for my birthday?","She likes to paint people at the beach","He is painting the mountain","My dad is painting the house white","She paints houses for work"]
 },
 {
	 "id": 647,
	 "label": "PAINTER",
	 "phrases": ["His mom is a painter","The painter is painting the farm","The painter has a lot of different colored paints","She is a painter. She likes to paint pictures of people."]
 },
 {
	 "id": 648,
	 "label": "brown",
	 "phrases": ["She is drinking brown coffee","The ground is brown","He is eating brown chocolate"]
 },
 {
	 "id": 649,
	 "label": "pink",
	 "phrases": ["The flower is pink","Pigs are pink","That bird is pink"]
 },
 {
	 "id": 650,
	 "label": "purple",
	 "phrases": ["Grapes are small purple fruits","This is a purple vegetable"]
 },
 {
	 "id": 651,
	 "label": "grey",
	 "phrases": ["He is old. He has grey hair.","The sky is grey. It looks like it will rain."]
 },
 {
	 "id": 652,
	 "label": "short",
	 "phrases": []
 },
 {
	 "id": 653,
	 "label": "short (vertical)",
	 "phrases": ["My daughter is short","The cat is very short"]
 },
 {
	 "id": 654,
	 "label": "short (horizontal)",
	 "phrases": ["The pencil is very short","There is a short table his bedroom"]
 },
 {
	 "id": 655,
	 "label": "short (time)",
	 "phrases": ["The book is a short read","She took a short shower"]
 },
 {
	 "id": 656,
	 "label": "long",
	 "phrases": ["The river is very long. It goes to the ocean.","He is on a long boat","There is a long table in the kitchen"]
 },
 {
	 "id": 657,
	 "label": "long (time)",
	 "phrases": ["I have not seen him in a very long time","It takes a long time for the bus to get to the city","She likes taking long walks on the beach"]
 },
 {
	 "id": 658,
	 "label": "tall",
	 "phrases": ["That man is very tall. He likes to play basketball.","That woman is tall","He is walking up a very tall mountain."]
 },
 {
	 "id": 659,
	 "label": "slow",
	 "phrases": ["He is old. He walks very slow.","The chicken is slow",""]
 },
 {
	 "id": 660,
	 "label": "fast",
	 "phrases": ["That man is a very fast at running.","The train is fast","Her dog is a fast runner"]
 },
 {
	 "id": 661,
	 "label": "quick",
	 "phrases": ["She can read books very quickly","The boy quickly ate the food and then ran to school","I will quickly go to the pharmacy"]
 },
 {
	 "id": 662,
	 "label": "dark",
	 "phrases": ["It is dark at night","His bedroom is very dark","There is no light in the bathroom. It is dark."]
 },
 {
	 "id": 663,
	 "label": "light",
	 "phrases": []
 },
 {
	 "id": 664,
	 "label": "light (visual)",
	 "phrases": ["The sun has a lot of light","The fire lit up the room","There is a lot of light in the living room"]
 },
 {
	 "id": 665,
	 "label": "light (noun)",
	 "phrases": ["The house has many lights","The bar's bathroom has a red light"]
 },
 {
	 "id": 666,
	 "label": "light (weight)",
	 "phrases": ["Her jacket is light","Paper is light","The bird is very small and light"]
 },
 {
	 "id": 667,
	 "label": "heavy",
	 "phrases": ["The dog is big. It is heavy.","The book has many pages. It is heavy.","The firefighter's jacket is heavy"]
 },
 {
	 "id": 668,
	 "label": "cool",
	 "phrases": ["The park was cool","It is cool outside","The juice is cool"]
 },
 {
	 "id": 669,
	 "label": "warm",
	 "phrases": ["It is warm outside","The tea is warm","He is wearing a jacket inside the cold house. He is warm."]
 },
 {
	 "id": 670,
	 "label": "easy",
	 "phrases": ["It is easy for a chef to cook food","It was easy for the teacher to teach students","She is tall. It is easy for her to play basketball."]
 },
 {
	 "id": 671,
	 "label": "difficult",
	 "phrases": ["He is slow. It is difficult for him to play football.","She thought the homework was difficult","This food is bad. It is difficult to eat."]
 },
 {
	 "id": 672,
	 "label": "strong",
	 "phrases": ["The firefighter is strong","He is strong. He is good at playing football.","She is very strong. She has big arms."]
 },
 {
	 "id": 673,
	 "label": "weak",
	 "phrases": ["The boy is weak. He can not play football.","The nurse helped the weak girl to her bed","My mom is not healthy. She is weak."]
 },
 {
	 "id": 674,
	 "label": "hard",
	 "phrases": ["The ground here is hard. It is bad for farming.","This bread is old. It is hard. It can not be eaten."]
 },
 {
	 "id": 675,
	 "label": "soft",
	 "phrases": ["The chicken is very soft","My hair is soft","The ground here is soft. It is good for farming."]
 },
 {
	 "id": 676,
	 "label": "rich",
	 "phrases": ["She has a lot of money. She is rich.","He works a lot. He wants to be rich.","Her parents are rich. She does not need to work."]
 },
 {
	 "id": 677,
	 "label": "poor",
	 "phrases": ["He is poor. He needs to find a job.","She is poor. She can not buy food.","The school has 1 teacher and 60 students. It is poor."]
 },
 {
	 "id": 678,
	 "label": "boring",
	 "phrases": ["She was bored at school and fell asleep in class.","This tv show is boring. I want to watching a movie.","This book is boring. Can I read your book?"]
 },
 {
	 "id": 679,
	 "label": "interesting",
	 "phrases": ["The movie was interesting. He wants to watch it again.","She thought the book was interesting. She wants to read the next book.","This food has purple fruit. It is interesting."]
 },
 {
	 "id": 680,
	 "label": "fun",
	 "phrases": ["My older brother and I had fun playing basketball in the park","She had fun playing the video game","I like going to school. It is fun."]
 },
 {
	 "id": 681,
	 "label": "ugly",
	 "phrases": ["The chicken's face looked ugly","The building is big and ugly","My hair feels ugly. I need a shower."]
 },
 {
	 "id": 682,
	 "label": "quiet",
	 "phrases": ["He is in the library. He needs to be quiet.","It is quiet in the library"]
 },
 {
	 "id": 683,
	 "label": "loud",
	 "phrases": ["They are playing a loud video game","She is talking loudly on the train"]
 },
 {
	 "id": 684,
	 "label": "old (object)",
	 "phrases": ["The librarian has an old phone","This old book is good"]
 },
 {
	 "id": 685,
	 "label": "new",
	 "phrases": ["He has a new tv. It is big.","Her new phone is white.","This phone is new. It was expensive.","The doctor bought a new house"]
 },
 {
	 "id": 686,
	 "label": "fine",
	 "phrases": ["She does not feel fine. She needs to go to the hospital.","He feels fine now","The movie was fine"]
 },
 {
	 "id": 687,
	 "label": "delicious",
	 "phrases": ["This food is delicious","He had a delicious drink of juice","That restaurant has delicious food"]
 },
 {
	 "id": 688,
	 "label": "famous",
	 "phrases": ["The singer is famous. Her songs are good.","That doctor is famous for helping many people in India","America has famous basketball players","Japan has many famous baseball players","France is famous for its food"]
 },
 {
	 "id": 689,
	 "label": "important",
	 "phrases": ["Drinking water is important","Eating food is important","It is important to sleep in a bed"]
 },
 {
	 "id": 690,
	 "label": "great",
	 "phrases": ["This food is great!","That book is a great read","Japan is great at making trains","India is great at making medicine"]
 },
 {
	 "id": 691,
	 "label": "fat",
	 "phrases": ["The cat eats lots of food. The cat is fat.","I am fat. I need to go play sport.","That bird is fat. It can not fly.","Her dog is fat. It can not run very fast."]
 },
 {
	 "id": 692,
	 "label": "flat",
	 "phrases": ["The table is flat","He has a flat head","The farmer needs to flatten the ground here","The beach is not flat"]
 },
 {
	 "id": 693,
	 "label": "ready",
	 "phrases": ["Are you ready to go to school?","I am ready to pay now","The train is ready to go","He is ready to eat"]
 },
 {
	 "id": 694,
	 "label": "clean",
	 "phrases": ["She took a shower. She is clean.","Her clothes are clean."]
 },
 {
	 "id": 695,
	 "label": "to clean",
	 "phrases": ["He cleaned the tv","She cleaned her clothes"]
 },
 {
	 "id": 696,
	 "label": "dirty",
	 "phrases": ["The boy is playing in the park. He is dirty.","The firefighter's clothes are dirty","The chef's shirt is dirty"]
 },
 {
	 "id": 697,
	 "label": "spring",
	 "phrases": ["The park has many new flowers in spring","After winter is spring","These trees are green in spring"]
 },
 {
	 "id": 698,
	 "label": "summer",
	 "phrases": ["There are many people at the beach in summer","It is hot in summer","I like to go swimming in summer"]
 },
 {
	 "id": 699,
	 "label": "autumn",
	 "phrases": ["Japan has many pretty pink trees in autumn","Autumn is after summer","These trees are orange in autumn"]
 },
 {
	 "id": 700,
	 "label": "winter",
	 "phrases": ["He likes to go to the snow in winter","It is cold in winter","You should wear a jacket in winter"]
 },
 {
	 "id": 701,
	 "label": "season",
	 "phrases": ["What season is after summer? Autumn","There are 4 seasons in a year","There are 3 months in a season","The 4 seasons are Summer, Autumn, Winter, and Spring."]
 },
 {
	 "id": 702,
	 "label": "morning",
	 "phrases": ["When did you go to school this morning?","The doctor goes to the hospital in the morning","She is not going to school this morning"]
 },
 {
	 "id": 703,
	 "label": "afternoon",
	 "phrases": ["He runs in the park in the afternoon","She is going to the library in the afternoon","My boy is playing a soccer match this afternoon"]
 },
 {
	 "id": 704,
	 "label": "evening",
	 "phrases": ["What do you want to eat this evening?","I want to watch tv this evening","My dad listens to the radio in the evening"]
 },
 {
	 "id": 705,
	 "label": "tonight",
	 "phrases": ["What are you doing tonight?","Do you want to eat at a restaurant tonight?","I need to go to the pharmacy tonight"]
 },
 {
	 "id": 706,
	 "label": "breakfast",
	 "phrases": ["I ate an apple for breakfast","What did you eat for breakfast?"]
 },
 {
	 "id": 707,
	 "label": "lunch",
	 "phrases": ["He ate rice and chicken for lunch","I'm eating a burger for lunch","Did you have a good lunch?"]
 },
 {
	 "id": 708,
	 "label": "dinner",
	 "phrases": ["She ate dinner at 7pm","What do you want to eat for dinner?","I like eating noodles for dinner"]
 },
 {
	 "id": 709,
	 "label": "past",
	 "phrases": ["The past can not be changed","This was his home in the past"]
 },
 {
	 "id": 710,
	 "label": "future",
	 "phrases": ["He thinks his future is good","She works so her daughter can have a good future"]
 },
 {
	 "id": 711,
	 "label": "early",
	 "phrases": ["The bus was early","He ate lunch early today","He arrived at school early"]
 },
 {
	 "id": 712,
	 "label": "late",
	 "phrases": ["The train is late","I am eating dinner late tonight","She was late getting to school","He was late to work"]
 },
 {
	 "id": 713,
	 "label": "later",
	 "phrases": ["The bus is coming later","He arrived at work later than you"]
 },
 {
	 "id": 714,
	 "label": "previous",
	 "phrases": ["She was bad at her previous job","His previous house was small","The previous book was easier to read"]
 },
 {
	 "id": 715,
	 "label": "next",
	 "phrases": ["I want to go to France next","Are you meeting him next?","I really like this next song"]
 },
 {
	 "id": 716,
	 "label": "place",
	 "phrases": ["This is a pretty place","This is a great place to live","We need to find a place to eat"]
 },
 {
	 "id": 717,
	 "label": "town",
	 "phrases": ["The town is very quiet","The town has a lot of people","I am from a town near the sea","He is going into town today"]
 },
 {
	 "id": 718,
	 "label": "start",
	 "phrases": ["After school, he started doing his homework","She started making dinner at 5pm","After drinking the orange juice, he started to feel better."]
 },
 {
	 "id": 719,
	 "label": "end",
	 "phrases": ["Her house is at the end of the street","I do not want summer to end"]
 },
 {
	 "id": 720,
	 "label": "street",
	 "phrases": ["There is no one on the street","They are playing cricket on the street","There is a black cat on the street"]
 },
 {
	 "id": 721,
	 "label": "road",
	 "phrases": ["There is a big road next to the hospital","There are 30 cars on the road","The big car is driving on the road"]
 },
 {
	 "id": 722,
	 "label": "address",
	 "phrases": ["What is your address?","He is at this address"]
 },
 {
	 "id": 723,
	 "label": "floor",
	 "phrases": ["Which floor are you on?","He lives on the 5th floor","This building has 12 floors","His home has 2 floors"]
 },
 {
	 "id": 724,
	 "label": "island",
	 "phrases": ["The island is small","The island has good beaches","This boat is going to the island"]
 },
 {
	 "id": 725,
	 "label": "sea",
	 "phrases": ["The beach is next to the sea","The boat is on the sea","There is a lot of water in the sea"]
 },
 {
	 "id": 726,
	 "label": "river",
	 "phrases": ["The small boat is on the river","She is swimming in the river","He is fishing on the river"]
 },
 {
	 "id": 727,
	 "label": "world",
	 "phrases": ["The world is big","The world has big blue oceans","The world has many people"]
 },
 {
	 "id": 728,
	 "label": "garden",
	 "phrases": ["My home has a small garden","She has many pretty flowers in her garden","There are red and yellow flowers in the garden"]
 },
 {
	 "id": 729,
	 "label": "pool",
	 "phrases": ["He is swimming in the pool","The pool's water is blue","Do you want to go swim in the pool?"]
 },
 {
	 "id": 730,
	 "label": "party",
	 "phrases": ["Are you going to his party?","They are having a party at the beach","He is having a party for his birthday"]
 },
 {
	 "id": 731,
	 "label": "concert",
	 "phrases": ["I went to the concert to watch her sing","She wants to watch him sing at the concert","Many people were at the concert"]
 },
 {
	 "id": 732,
	 "label": "class",
	 "phrases": ["When is your next class?","Are you in class?","What classes does the school teach?","He is in French Class"]
 },
 {
	 "id": 733,
	 "label": "classroom",
	 "phrases": ["The classroom has 9 students","She is teaching inside a small classroom","The classroom is big. It can have 30 students."]
 },
 {
	 "id": 734,
	 "label": "club",
	 "phrases": ["The school has 5 clubs","I am going to photography club after school","He is in the school swimming club"]
 },
 {
	 "id": 735,
	 "label": "college",
	 "phrases": ["Are you going to college?","He is on the college football team","She is studying to be a doctor at college","He is studying to be a teacher at this college"]
 },
 {
	 "id": 736,
	 "label": "business",
	 "phrases": ["My mom and dad have a small business","He wants to start his own business","She has a business taking photographs of people"]
 },
 {
	 "id": 737,
	 "label": "MAP",
	 "phrases": ["Where can I find a map of the city?","Can I have a map of the park please?","I'm lost. Is there a map of the train station?","Excuse me, where is the hotel on this map?"]
 },
 {
	 "id": 738,
	 "label": "come",
	 "phrases": ["Please come on time","Winter is coming","You can come to my house if you want to"]
 },
 {
	 "id": 739,
	 "label": "visit",
	 "phrases": ["I am visiting my mom today","Her daughter visited her in the hospital","He visited the library after school"]
 },
 {
	 "id": 740,
	 "label": "travel",
	 "phrases": ["I want to travel to India","She is traveling to America","Do you want to travel to Japan?"]
 },
 {
	 "id": 741,
	 "label": "put",
	 "phrases": ["She put a book on the table","He put his pencil down","I need to put the food on the table"]
 },
 {
	 "id": 742,
	 "label": "move",
	 "phrases": ["He is moving the tv over there","She moved the table to the kitchen","He moved his laptop to the left"]
 },
 {
	 "id": 743,
	 "label": "carry",
	 "phrases": ["She is carrying 3 books in her bag","He is carrying a box of oranges","They are carrying a table into the living room"]
 },
 {
	 "id": 744,
	 "label": "bring",
	 "phrases": ["He brought food with him to school","She brought her daughter to the hospital","He brought his younger brother to the library"]
 },
 {
	 "id": 745,
	 "label": "climb",
	 "phrases": ["She climbed up the mountain","He likes climbing up trees","It is not safe to climb up buildings"]
 },
 {
	 "id": 746,
	 "label": "look",
	 "phrases": ["He looked at the man in the purple shirt","The cat looked at the food on the table","The doctor looked at the woman. The doctor was sad."]
 },
 {
	 "id": 747,
	 "label": "wash",
	 "phrases": ["His clothes were dirty. He washed his clothes.","Please wash your hands before eating food","I need to wash the car","Was fruits and vegetables before eating them"]
 },
 {
	 "id": 748,
	 "label": "live",
	 "phrases": ["My mom lives in India","His dad lives in America","I live in that building","Where do you live?"]
 },
 {
	 "id": 749,
	 "label": "sit",
	 "phrases": ["There is a cat sitting on the chair","He is sitting on a chair"]
 },
 {
	 "id": 750,
	 "label": "stand",
	 "phrases": ["He is standing on the train platform","Please stand here and wait"]
 },
 {
	 "id": 751,
	 "label": "still",
	 "phrases": ["She told the students to sit still","His daughter can not stand still","You must sit still"]
 },
 {
	 "id": 752,
	 "label": "stop",
	 "phrases": ["Please stop singing","The car stopped at the light","The train does not stop at this platform","The bus stopped at the bus stop"]
 },
 {
	 "id": 753,
	 "label": "stay",
	 "phrases": ["He is sick. He is staying at home today.","She needs to stay at the hospital tonight","I am staying at that hotel"]
 },
 {
	 "id": 754,
	 "label": "try",
	 "phrases": ["You need to try that new restaurant. It is very good.","I am trying to finish my homework","He is trying to look for his book"]
 },
 {
	 "id": 755,
	 "label": "write",
	 "phrases": ["He writes books","She writes newspapers","He wrote his name on the paper"]
 },
 {
	 "id": 756,
	 "label": "remember",
	 "phrases": ["I remember your mom has a restaurant","She is old. She can not remember her phone number.","Do you remember your address?"]
 },
 {
	 "id": 757,
	 "label": "forget",
	 "phrases": ["I forget if this restaurant is good or not","Do not forget to close the door","He forgot to close the window"]
 },
 {
	 "id": 758,
	 "label": "think",
	 "phrases": ["What do you think of the new movie?","Do you think I need an umbrella?","Think before you speak"]
 },
 {
	 "id": 759,
	 "label": "guess",
	 "phrases": ["Can you guess what he's thinking?","I can not guess her age","She guessed the correct answer"]
 },
 {
	 "id": 760,
	 "label": "study",
	 "phrases": ["He studied a lot","She likes studying French","He is studying English in the library"]
 },
 {
	 "id": 761,
	 "label": "test",
	 "phrases": ["I have to study for the test","He did well at the test","The doctor tested his health","The teacher gave her students tests"]
 },
 {
	 "id": 762,
	 "label": "practice",
	 "phrases": ["She is practicing her singing","The man has been practicing basketball for 5 years","The big brother is practicing the guitar"]
 },
 {
	 "id": 763,
	 "label": "ask",
	 "phrases": ["The girl asked the teacher a question","He asked the doctor a question","She asked the policeman where the train station was"]
 },
 {
	 "id": 764,
	 "label": "talk",
	 "phrases": ["She talks a lot","The teacher is talking","The doctor talked about her health"]
 },
 {
	 "id": 765,
	 "label": "tell",
	 "phrases": ["He told her where to go","Can you please tell me where the toilet is?","Have you told him you like him?"]
 },
 {
	 "id": 766,
	 "label": "say",
	 "phrases": ["He said \"Hello\" in French","She said \"Good Morning\" in Japanese","Do you know how to say \"Thank You\" in Hindi?"]
 },
 {
	 "id": 767,
	 "label": "spell",
	 "phrases": ["How do you spell this word?","Can you spell that word please?","Can you spell \"Good Morning\"?"]
 },
 {
	 "id": 768,
	 "label": "repeat",
	 "phrases": ["Please repeat that","He needed to repeat the test","Could you please repeat the question?"]
 },
 {
	 "id": 769,
	 "label": "again",
	 "phrases": ["He had fruit for lunch again","She is going to the library again","He tried to play football again"]
 },
 {
	 "id": 770,
	 "label": "dance",
	 "phrases": ["Do you want to dance with me?","The woman is dancing in the park","The singer is good at dancing"]
 },
 {
	 "id": 771,
	 "label": "fly",
	 "phrases": ["The chicken can not fly","The bird can fly","The plane flew to India","He flew to France"]
 },
 {
	 "id": 772,
	 "label": "become",
	 "phrases": ["The boy became bigger","He is becoming good at baseball","She is becoming good at speaking English"]
 },
 {
	 "id": 773,
	 "label": "will",
	 "phrases": ["Will you go to school today?","I will go to the hospital today","She will not eat this apple"]
 },
 {
	 "id": 774,
	 "label": "let",
	 "phrases": ["Please let me know when you arrive","She would not let him drive her car","Let's go to the movie tonight","Let me help you with your luggage"]
 },
 {
	 "id": 775,
	 "label": "must",
	 "phrases": ["I must call the hospital","She must call her mom","Students must wear pants to school","You must arrive on time"]
 },
 {
	 "id": 776,
	 "label": "activity",
	 "phrases": ["There is a lot of police activity in the park","The children are doing fun activities","What activities do you do at night?"]
 },
 {
	 "id": 777,
	 "label": "action",
	 "phrases": ["The firefighter took action","I am sorry for my actions. I did not want to hurt you.","We need more action and less talk","The doctor took actions to make the man healthier"]
 },
 {
	 "id": 778,
	 "label": "holiday",
	 "phrases": ["I am going to Japan on holiday","What are you doing this holiday?","I like going to India on holidays","It is good not to have to work on holidays"]
 },
 {
	 "id": 779,
	 "label": "birthday",
	 "phrases": ["Are you going to her birthday party?","His birthday is tomorrow","She gave him a book for his birthday"]
 },
 {
	 "id": 780,
	 "label": "match",
	 "phrases": ["Do you want to go to the basketball match?","He is watching the soccer match","He bought tickets to the baseball match"]
 },
 {
	 "id": 781,
	 "label": "to match",
	 "phrases": ["His blue jacket matched the color of his eyes","They wore matching dresses","The bed's color matched the room's"]
 },
 {
	 "id": 782,
	 "label": "show",
	 "phrases": ["Did you go to the show yesterday?","The singer has a show tomorrow","This tv show is not good"]
 },
 {
	 "id": 783,
	 "label": "to show",
	 "phrases": ["He showed me his book","Can you show me the photograph?","The photograph showed that the man was bad"]
 },
 {
	 "id": 784,
	 "label": "event",
	 "phrases": ["The sporting event is on tv","Are you going to the event tomorrow?","The book reading at the library was a good event"]
 },
 {
	 "id": 785,
	 "label": "vacation",
	 "phrases": ["We are going on a beach vacation this weekend","My mom and dad went to America for a 2 week vacation","I have been working a lot. I need a vacation."]
 },
 {
	 "id": 786,
	 "label": "festival",
	 "phrases": ["Did you have fun at the festival?","The festival was loud","There are a lot of people at the festival"]
 },
 {
	 "id": 787,
	 "label": "interview",
	 "phrases": ["I need more money. I have a job interview tomorrow.","The writer interviewed him for a book she is writing","She had a job interview at the hospital"]
 },
 {
	 "id": 788,
	 "label": "New Year’s Day",
	 "phrases": ["New Year's Day is on January 1st","Are you coming to my house for New Year's Day?","What are you doing on New Year's Day?"]
 },
 {
	 "id": 789,
	 "label": "Christmas",
	 "phrases": ["I got a gift for my son for Christmas","The bad girl got no gifts on Christmas","I like to watch movies with my mom and dad on Christmas"]
 },
 {
	 "id": 790,
	 "label": "Australia",
	 "phrases": ["Australians and Americans can speak English","When it is Winter in Japan, it is Summer in Australia","Australia is a big island"]
 },
 {
	 "id": 791,
	 "label": "January ",
	 "phrases": ["January is the 1st month of the year","New Year's Day is on January 1st"]
 },
 {
	 "id": 792,
	 "label": "February",
	 "phrases": ["February is the 2nd month of the year"]
 },
 {
	 "id": 793,
	 "label": "March",
	 "phrases": ["March is the 3rd month of the year"]
 },
 {
	 "id": 794,
	 "label": "April",
	 "phrases": ["April is the 4th month of the year"]
 },
 {
	 "id": 795,
	 "label": "May",
	 "phrases": ["May is the 5th month of the year"]
 },
 {
	 "id": 796,
	 "label": "June",
	 "phrases": ["June is the 6th month of the year"]
 },
 {
	 "id": 797,
	 "label": "July",
	 "phrases": ["July is the 7th month of the year"]
 },
 {
	 "id": 798,
	 "label": "August",
	 "phrases": ["August is the 8th month of the year"]
 },
 {
	 "id": 799,
	 "label": "September",
	 "phrases": ["September is the 9th month of the year","There are many birthdays in September"]
 },
 {
	 "id": 800,
	 "label": "October",
	 "phrases": ["October is the 10th month of the year"]
 },
 {
	 "id": 801,
	 "label": "November",
	 "phrases": ["November is the 11th month of the year"]
 },
 {
	 "id": 802,
	 "label": "December",
	 "phrases": ["December is the 12th month of the year","Christmas is on December 25th"]
 },
 {
	 "id": 803,
	 "label": "calendar",
	 "phrases": ["He has a calendar on his desk","My calendar has a lot of meetings","Her calendar is on her phone"]
 },
 {
	 "id": 804,
	 "label": "soon",
	 "phrases": ["I need to go to work soon","The train will arrive soon","I will see you soon"]
 },
 {
	 "id": 805,
	 "label": "moment",
	 "phrases": ["The moment I saw her, I liked her.","The movie had a lot of good moments","I am ready for this moment"]
 },
 {
	 "id": 806,
	 "label": "period",
	 "phrases": ["This is a difficult period in his life","School was an important period for me"]
 },
 {
	 "id": 807,
	 "label": "until",
	 "phrases": ["The shop does not open until 9 am","You will not know until you ask","We do not have an umbrella. We must wait until the rain stops."]
 },
 {
	 "id": 808,
	 "label": "date",
	 "phrases": ["The milk is past its expiry date","What is the date of the meeting?"]
 },
 {
	 "id": 809,
	 "label": "happen",
	 "phrases": ["Good things happen to those who wait","What happened in the movie?","What will happen at the meeting?"]
 },
 {
	 "id": 810,
	 "label": "ago",
	 "phrases": ["I came here a year ago","We met at the hospital 2 weeks ago","I saw the doctor 1 week ago","She called me 1 hour ago"]
 },
 {
	 "id": 811,
	 "label": "before",
	 "phrases": ["I eat breakfast before I go to school","I have not been here before","Do you exercise before eating dinner?"]
 },
 {
	 "id": 812,
	 "label": "after",
	 "phrases": ["After exercising, I go to sleep","Do you want to watch tv after school?","What are you doing after work?"]
 },
 {
	 "id": 813,
	 "label": "around",
	 "phrases": ["He looked around for his phone","They sat around the tree and talked","We walked around the park"]
 },
 {
	 "id": 814,
	 "label": "into",
	 "phrases": ["He went into the clothing store","He put his books into the box","She put carrots into her shopping cart"]
 },
 {
	 "id": 815,
	 "label": "off",
	 "phrases": ["Please turn the tv off","Is the radio off?","He went off to school","She took off her jacket"]
 },
 {
	 "id": 816,
	 "label": "high",
	 "phrases": ["The bridge is high above the ground","The mountain is very high"]
 },
 {
	 "id": 817,
	 "label": "low",
	 "phrases": ["In summer, the water in the lake is low","The cat sat low on the ground"]
 },
 {
	 "id": 818,
	 "label": "away",
	 "phrases": ["He moved away from home","He put his video game away and went to sleep","The cat ran away from the dog","He threw away his old books"]
 },
 {
	 "id": 819,
	 "label": "through",
	 "phrases": ["The plane flew through the clouds","He opened the door and went through","She walks through the park to get to school"]
 },
 {
	 "id": 820,
	 "label": "thank",
	 "phrases": ["He thanked her for the birthday gift","She thanked him for the Christmas gift","I should thank him for helping me","Please thank your mom for me"]
 },
 {
	 "id": 821,
	 "label": "why",
	 "phrases": ["Why do you go to school?","Why is the room cold?","I do not know why he is in the hospital"]
 },
 {
	 "id": 822,
	 "label": "the",
	 "phrases": ["The book is blue","The house is yellow","The tv is small"]
 },
 {
	 "id": 823,
	 "label": "a",
	 "phrases": ["He has a blue book","Can I have an orange please?","I need a white dress"]
 },
 {
	 "id": 824,
	 "label": "but",
	 "phrases": ["I wanted to go to the party, but I was tired","I like to play basketball, but I am not very good.","We wanted to go to the park, but it rained."]
 },
 {
	 "id": 825,
	 "label": "so",
	 "phrases": ["He was tired, so he went to bed","It was cold, so she wore a jacket","I did not have money, so I did not buy the book"]
 },
 {
	 "id": 826,
	 "label": "also",
	 "phrases": ["Are you buying eggs? Can you also buy milk?","I also want to go to France","He also likes dogs more than cats "]
 },
 {
	 "id": 827,
	 "label": "if",
	 "phrases": ["If it rains, we will stay home.","If I pass the test, I will be happy.","If you come to my house, we can play video games"]
 },
 {
	 "id": 828,
	 "label": "or",
	 "phrases": ["Do you wear a dress or pants to school?","Do you want to drink water or milk?","Do you know if she is French or Japanese"]
 },
 {
	 "id": 829,
	 "label": "else",
	 "phrases": ["If you don't like this food, eat something else","Who else is here?","What else do you sell?"]
 },
 {
	 "id": 830,
	 "label": "because",
	 "phrases": ["I am tired because I ran to school","They can not play soccer because of the rain","The plants are dying because they did not get watered"]
 },
 {
	 "id": 831,
	 "label": "too",
	 "phrases": ["I like cats too!","He is going to the library too","I want to see you there too"]
 },
 {
	 "id": 832,
	 "label": "as",
	 "phrases": ["That woman works as a teacher","He ran as fast as he could","My mom works as a doctor"]
 },
 {
	 "id": 833,
	 "label": "by",
	 "phrases": ["I like to travel by train","The child sat by the tv","The apple was eaten by the dog"]
 },
 {
	 "id": 834,
	 "label": "snake",
	 "phrases": ["Do not go to the park. There is a snake in the park.","The snake is long and green","Be careful of the snake"]
 },
 {
	 "id": 835,
	 "label": "lion",
	 "phrases": ["The lion has long orange hair","Lions are big cats","The lion wants food"]
 },
 {
	 "id": 836,
	 "label": "sheep",
	 "phrases": ["The sheep is white and soft","The farmer has 12 sheep","The dog is running to the sheeps"]
 },
 {
	 "id": 837,
	 "label": "mouse",
	 "phrases": ["The mouse is small and white","He has a mouse at home","The mouse likes to eat cheese"]
 },
 {
	 "id": 838,
	 "label": "horse",
	 "phrases": ["The horse can run very fast","The horse is big","She wants to ride a horse"]
 },
 {
	 "id": 839,
	 "label": "star",
	 "phrases": ["The star is far away","The star is yellow","Our sun is a star"]
 },
 {
	 "id": 840,
	 "label": "snow",
	 "phrases": ["There is a lot of snow on the mountain","I like playing in the snow in winter","Snow is white and cold","Snow is cold"]
 },
 {
	 "id": 841,
	 "label": "rain",
	 "phrases": ["It looks like it will rain today","Do I need an umbrella? Will it rain today?","The rain will stop in 10 minutes"]
 },
 {
	 "id": 842,
	 "label": "weather",
	 "phrases": ["What is the weather?","The weather does not look good today","The weather is good in summer"]
 },
 {
	 "id": 843,
	 "label": "wall",
	 "phrases": ["The house's walls are white","He has a picture of his family on the wall","There is a big window on that wall","She has a tv on the wall"]
 },
 {
	 "id": 844,
	 "label": "glass (container)",
	 "phrases": ["Can I have a glass of water?","She is drinking a glass of milk","Can I please have a glass of orange juice?"]
 },
 {
	 "id": 845,
	 "label": "glass",
	 "phrases": ["The church has beautiful glass windows","That woman has a glass shoe","They have a glass table","Windows are made of glass"]
 },
 {
	 "id": 846,
	 "label": "machine",
	 "phrases": ["The doctor used a machine to look inside his body","Washing machines can help you wash clothes","This coffee machine makes good coffee","There is a big machine inside the factory"]
 },
 {
	 "id": 847,
	 "label": "video",
	 "phrases": ["She likes watching videos of cats","He took a video of the police","Can you please take a video of me singing?","Do you have any videos from karaoke?"]
 },
 {
	 "id": 848,
	 "label": "butter",
	 "phrases": ["She put butter on her bread","He cooked his eggs in butter","Butter is yellow"]
 },
 {
	 "id": 849,
	 "label": "sugar",
	 "phrases": ["There is a lot of sugar in the cake","She likes to have sugar in her tea","I brought some sugar from the grocery store"]
 },
 {
	 "id": 850,
	 "label": "cheese",
	 "phrases": ["The mouse is eating cheese","She added cheese to her noodles","My Japanese friend can not eat cheese"]
 },
 {
	 "id": 851,
	 "label": "chocolate",
	 "phrases": ["I really like eating chocolate","He gave her chocolate because he likes her","She likes drink chocolate milk"]
 },
 {
	 "id": 852,
	 "label": "sandwich",
	 "phrases": ["The sandwich had white bread","He likes to have meat in his sandwich","He brought a sandwich to school"]
 },
 {
	 "id": 853,
	 "label": "cake",
	 "phrases": ["I am getting her a pink cake for her birthday","She likes eating apple cake","The cake is cold and delicious"]
 },
 {
	 "id": 854,
	 "label": "cream",
	 "phrases": ["She put cream on her face","I like to eat strawberries with cream","She put cream on her bread"]
 },
 {
	 "id": 855,
	 "label": "bottle",
	 "phrases": ["The runner has a bottle of water","He bought a bottle of juice at the grocery store","She gave the baby a bottle of milk"]
 },
 {
	 "id": 856,
	 "label": "dish",
	 "phrases": ["This dish tastes good","She taught him a new dish in the kitchen","This is a famous Japanese dish"]
 },
 {
	 "id": 857,
	 "label": "meal",
	 "phrases": ["She made a good meal for lunch","Can you cook me a vegetarian meal?","The chef made a good meal"]
 },
 {
	 "id": 858,
	 "label": "ice",
	 "phrases": ["The orange juice had ice","The ice tea is cold","In winter, there is a lot of ice on the road"]
 },
 {
	 "id": 859,
	 "label": "ice cream",
	 "phrases": ["I ate ice cream after dinner","The ice cream shop had a lot of people","She likes to eat ice cream when she is sad"]
 },
 {
	 "id": 860,
	 "label": "salad",
	 "phrases": ["Eating salads is good for your health","The salad had a lot of vegetables","I find it hard to eat salads"]
 },
 {
	 "id": 861,
	 "label": "soup",
	 "phrases": ["The chicken soup was warm","Soup is good to drink when you are sick","I like eating vegetable soup"]
 },
 {
	 "id": 862,
	 "label": "afraid",
	 "phrases": ["She is afraid of mice","He is afraid of losing the baseball match","Are you afraid of dogs?"]
 },
 {
	 "id": 863,
	 "label": "mean",
	 "phrases": ["What does this word mean?","The teacher told me what the book meant","You didn't mean to hurt him"]
 },
 {
	 "id": 864,
	 "label": "nice",
	 "phrases": ["He bought a nice shirt","This restaurant has nice food","That was a nice thing that you did","She has a nice house"]
 },
 {
	 "id": 865,
	 "label": "excited",
	 "phrases": ["The dog is excited to go to the park","She is excited for her birthday party","Are you excited to go to Japan?"]
 },
 {
	 "id": 866,
	 "label": "exciting",
	 "phrases": ["The school was exciting today","Visiting the lake was exciting for the children","The book has an exciting story","Meeting new people is exciting"]
 },
 {
	 "id": 867,
	 "label": "funny",
	 "phrases": ["The movie is funny","She likes funny men","The tv show is funny to children"]
 },
 {
	 "id": 868,
	 "label": "laugh",
	 "phrases": ["The book was so funny she laughed","He has a loud laugh","He made me laugh with a funny story"]
 },
 {
	 "id": 869,
	 "label": "enjoy",
	 "phrases": ["I enjoy reading a good book","He enjoys playing baseball","She enjoys playing the piano","Do you enjoy traveling to different countries?"]
 },
 {
	 "id": 870,
	 "label": "interested",
	 "phrases": ["She is interested in him","I am interested in learning her language","My younger brother is interested in the video game"]
 },
 {
	 "id": 871,
	 "label": "hope",
	 "phrases": ["I hope I can travel to America one day","She hopes she can buy a car next year","He hopes his son will be good at French"]
 },
 {
	 "id": 872,
	 "label": "believe",
	 "phrases": ["I believe in you","He did not believe the news","She believes that people are good","I believe this is your book"]
 },
 {
	 "id": 873,
	 "label": "love",
	 "phrases": ["I love eating food","He loves playing tennis","She loves writing news articles","I love you"]
 },
 {
	 "id": 874,
	 "label": "hungry",
	 "phrases": ["The cat in the park is hungry","I am hungry after basketball practice","He was so hungry, he ate two burgers."]
 },
 {
	 "id": 875,
	 "label": "full",
	 "phrases": ["The cup is full of juice","That box is full of clothes","I am full after eating dinner"]
 },
 {
	 "id": 876,
	 "label": "tired",
	 "phrases": ["She is tired after running in the park","He is so tired, he went to bed.","They were tired from climbing the mountain","Are you tired from the gym?"]
 },
 {
	 "id": 877,
	 "label": "sick",
	 "phrases": ["He is sick, so he did not go to school.","The sick man went to the hospital","I feel sick when I'm on boats","She can not come to work because her child is sick"]
 },
 {
	 "id": 878,
	 "label": "well",
	 "phrases": ["She draws very well","He speaks English well","I know this book well"]
 },
 {
	 "id": 887,
	 "label": "problem",
	 "phrases": ["Money is not a problem for her","My computer has a problem","The noise next to the house is a problem","She does not understand the problem","I have a problem with my phone","Can you help me with this problem?"]
 },
 {
	 "id": 888,
	 "label": "question",
	 "phrases": ["I have a question for the doctor","Did you have any questions for the teacher?","The student asked the teacher a question","This question is difficult"]
 },
 {
	 "id": 889,
	 "label": "answer",
	 "phrases": ["Do you know how to answer the question?","His answer was not correct","He gave a quick answer","There is no easy answer to the question"]
 },
 {
	 "id": 890,
	 "label": "story",
	 "phrases": ["I love reading a good story","She read her daughter a story in bed","This story is scary","The teacher told them to write a story"]
 },
 {
	 "id": 891,
	 "label": "article",
	 "phrases": ["The news article is sad","I am writing an article about healthy eating","The magazine had a good article about the doctor"]
 },
 {
	 "id": 892,
	 "label": "sentence",
	 "phrases": ["The teacher asked them to write a sentence about home","Can you write a sentence about France?","I do not understand this sentence"]
 },
 {
	 "id": 893,
	 "label": "letter",
	 "phrases": []
 },
 {
	 "id": 894,
	 "label": "letter (alphabet)",
	 "phrases": ["There are 5 letters in this word","How many letters are in this word?","She wrote a letter to her old teacher"]
 },
 {
	 "id": 895,
	 "label": "letter (message)",
	 "phrases": ["He wrote her a letter from America","She got a letter from her older brother","The letter was long","I can't read this letter because it's written in Hindi"]
 },
 {
	 "id": 896,
	 "label": "word",
	 "phrases": ["What does this word mean?","How many words are in this sentence?","I do not understand this word"]
 },
 {
	 "id": 897,
	 "label": "paragraph",
	 "phrases": ["Write a paragraph about your favorite sport","She wrote a paragraph about her dog","He wrote a long paragraph for the homework question"]
 },
 {
	 "id": 898,
	 "label": "about",
	 "phrases": ["What do you know about that man?","She wrote a book about her life","I am reading a book about India"]
 },
 {
	 "id": 899,
	 "label": "favorite",
	 "phrases": ["Who is your favorite singer?","What is your favorite book?","His favorite color is green"]
 },
 {
	 "id": 900,
	 "label": "subject",
	 "phrases": ["English is my favorite subject","They talked about different subjects","He and she like talking about the same subjects","I studied that subject a lot at univeristy"]
 },
 {
	 "id": 901,
	 "label": "topic",
	 "phrases": ["She changed the topic","They for a long time about the topic","My older sister and I like talking about the same topics"]
 },
 {
	 "id": 902,
	 "label": "section",
	 "phrases": ["My favorite section in the newspaper is the section about the weather","He finished writing the first section of the paper","The toilet is in the last section of the building","The sports section of the store is on the second floor"]
 },
 {
	 "id": 903,
	 "label": "example",
	 "phrases": ["Is this an example of your best work?","He is an example of a good person","Eating more vegetables is one example of how you can be healthier"]
 },
 {
	 "id": 904,
	 "label": "conversation",
	 "phrases": ["I enjoyed our conversation on the beach","After dinner, we had a nice conversation","The teacher heard our conversation"]
 },
 {
	 "id": 905,
	 "label": "message",
	 "phrases": ["Did you receive my message?","I need to message my mom","He sent a message to his younger brother"]
 },
 {
	 "id": 906,
	 "label": "send",
	 "phrases": ["Please send me directions to the hotel","I forgot to send the message","She sent her dad a Christmas card"]
 },
 {
	 "id": 907,
	 "label": "skill",
	 "phrases": ["She has great writing skills","His piano skills are good","He showed us his cooking skill"]
 },
 {
	 "id": 908,
	 "label": "hobby",
	 "phrases": ["Photography is my hobby","Reading is my favorite hobby","Fishing is a nice hobby"]
 },
 {
	 "id": 909,
	 "label": "job",
	 "phrases": ["He is looking for a new job","What is your job?","Do you like your job?","I hope your job interview goes well","Swimming is a healthy hobby"]
 },
 {
	 "id": 910,
	 "label": "culture",
	 "phrases": ["The film shows us Indian culture","I like studying Japanese culture","Traveling helpings you understand different cultures","The school teaches French culture"]
 },
 {
	 "id": 911,
	 "label": "history",
	 "phrases": ["He teaches history at the school","She likes to learn about history","This house has a scary history"]
 },
 {
	 "id": 912,
	 "label": "science",
	 "phrases": ["She studied science in college","Do you like studying science?","Teaching science can be difficult"]
 },
 {
	 "id": 913,
	 "label": "age",
	 "phrases": ["At this age, the boy needs to go to school","My children are different ages","She is 15 years of age"]
 },
 {
	 "id": 914,
	 "label": "course",
	 "phrases": ["She is in a Hindi course","I finished the online course","The boat changed course"]
 },
 {
	 "id": 915,
	 "label": "lesson",
	 "phrases": ["Today's French lesson is about food","She is taking guitar lessons","They have a tennis lesson tomorrow"]
 },
 {
	 "id": 916,
	 "label": "information",
	 "phrases": ["I need more information before I can buy this book","The librarian gave him information about where to go","My phone has a lot of information about me"]
 },
 {
	 "id": 917,
	 "label": "result",
	 "phrases": ["The scientist looked at the results of the test","The doctor told him his test's results are good","He is happy with the result"]
 },
 {
	 "id": 918,
	 "label": "form",
	 "phrases": ["You need to finish this form","This is a long form","I lost the form and had to get another"]
 },
 {
	 "id": 919,
	 "label": "rule",
	 "phrases": ["They changed the rules again","The library has a rule that you should not speak loudly","He remembered an important rule"]
 },
 {
	 "id": 920,
	 "label": "reason",
	 "phrases": ["He did not know the reason for her sadness","He had a good reason for why he did what he did","What is your reason for visiting India?"]
 },
 {
	 "id": 921,
	 "label": "dollar",
	 "phrases": ["He gave me a dollar for my help","The book costs 20 dollars","The shirt was on sale for 5 dollars"]
 },
 {
	 "id": 922,
	 "label": "number",
	 "phrases": ["What is your phone number?","The number is on the back of the computer","The number on the house is seven"]
 },
 {
	 "id": 923,
	 "label": "order",
	 "phrases": ["He read the books in order","She watched the shows in order"]
 },
 {
	 "id": 924,
	 "label": "list",
	 "phrases": ["Please make a list for groceries","Your name is on his list","He has 10 things on his shopping list"]
 },
 {
	 "id": 925,
	 "label": "group",
	 "phrases": ["The group of students talked about the test","They created a study group","The travel group is going to Japan next"]
 },
 {
	 "id": 926,
	 "label": "kind",
	 "phrases": ["What kind of movie do you want to watch?","What kind of dog is this?","This kind of music is nice"]
 },
 {
	 "id": 927,
	 "label": "type",
	 "phrases": ["What type of car do you drive?","We looked at different types of art at the museum","He found the type of medicine he needed"]
 },
 {
	 "id": 928,
	 "label": "way",
	 "phrases": ["She knows the way to the museum","Which way is the beach?","Can you please show me the way to the train station?"]
 },
 {
	 "id": 929,
	 "label": "trip",
	 "phrases": ["They went on a trip to France","My business trip was good","Our trip was tiring but fun","The school went on a trip to the museum"]
 },
 {
	 "id": 930,
	 "label": "idea",
	 "phrases": ["The idea of climbing a mountain scares me","The writer has an idea for a new book","It was his idea to go to the city"]
 },
 {
	 "id": 931,
	 "label": "meeting",
	 "phrases": ["We have a meeting tomorrow","The meeting will start at 10am","I met her at a meeting","Do you have any idea what you want to do tomorrow?"]
 },
 {
	 "id": 932,
	 "label": "band",
	 "phrases": ["The band played beautiful music","He plays the guitar in the school band","The band's music is good"]
 },
 {
	 "id": 933,
	 "label": "difference",
	 "phrases": ["There is a big difference in their ages","There is no difference in the shirts' cost"]
 },
 {
	 "id": 934,
	 "label": "really",
	 "phrases": ["She really enjoys reading","I really want that cake","He really needs to leave now"]
 },
 {
	 "id": 935,
	 "label": "real",
	 "phrases": ["Is he a real doctor?","She is a real friend","Is this a real taxi?","I could not believe this was real"]
 },
 {
	 "id": 936,
	 "label": "TRUE",
	 "phrases": ["His story is true","He is a true friend","Is it true that your are leaving?"]
 },
 {
	 "id": 937,
	 "label": "FALSE",
	 "phrases": ["She used a false name","The news article was false","He wrote down false information"]
 },
 {
	 "id": 938,
	 "label": "correct",
	 "phrases": ["Please correct me if I am wrong","Was the answer correct?","The clock's time is not correct","The teacher corrected my homework"]
 },
 {
	 "id": 939,
	 "label": "wrong",
	 "phrases": ["He went in the wrong direction","The box was delivered to the wrong address","Her guess was wrong"]
 },
 {
	 "id": 940,
	 "label": "wonderful",
	 "phrases": ["We had a wonderful time at the party","Our teacher is a wonderful mountain","This is a wonderful song"]
 },
 {
	 "id": 941,
	 "label": "terrible",
	 "phrases": ["This food is terrible","She got terrible news from the hospital","I am terrible at singing"]
 },
 {
	 "id": 942,
	 "label": "better",
	 "phrases": ["He is better than me at basketball","Your job is better than mine","The weather is better today","She sings better than she dances"]
 },
 {
	 "id": 943,
	 "label": "best",
	 "phrases": ["He is the best basketball player","She is the best student in the class","This restaurant serves the best burger"]
 },
 {
	 "id": 944,
	 "label": "worse",
	 "phrases": ["The weather got worse in the evening","My mom's health is getting worse","She feels much worse today","This story is worse than the first one"]
 },
 {
	 "id": 945,
	 "label": "worst",
	 "phrases": ["This is the worst movie I've ever seen","That is the worst idea I have heard","The worst thing about the job is the long hours"]
 },
 {
	 "id": 946,
	 "label": "personal",
	 "phrases": ["Sorry, that is a personal question","The doctor gave me his personal phone number","They are rich. They have a personal chef."]
 },
 {
	 "id": 947,
	 "label": "free",
	 "phrases": ["The event is free for everyone","The library has free internet","The store has free delivery"]
 },
 {
	 "id": 948,
	 "label": "just",
	 "phrases": ["He got to school just in time","She just left the house","I just finished my homework","He's just a friend"]
 },
 {
	 "id": 949,
	 "label": "special",
	 "phrases": ["Today is a special day","She made a special cake for the party","He is a special person in my life"]
 },
 {
	 "id": 950,
	 "label": "sure",
	 "phrases": ["I'm sure he will come","I'm sure they will win the match","He was sure he left his keys here","Are you sure she will like that gift?"]
 },
 {
	 "id": 951,
	 "label": "all",
	 "phrases": ["I ate all the apples","My dog ate all his food","We all love eating burgers","All the flowers in his garden are beautiful"]
 },
 {
	 "id": 952,
	 "label": "half",
	 "phrases": ["The sandwich was bad. I only ate half of it.","He sliced the apple in half","She has read half the book"]
 },
 {
	 "id": 953,
	 "label": "quarter",
	 "phrases": ["He sliced the cake into quarters","A quarter of the students were late to school","The basketball game is in its second quarter"]
 },
 {
	 "id": 954,
	 "label": "only",
	 "phrases": ["She is the only child in her family","I only have five dollars","She only eats vegetables","This is my only jacket"]
 },
 {
	 "id": 955,
	 "label": "every",
	 "phrases": ["I brush my teeth every morning and night","He goes to the gym every day","Every child at the party received a gift","Every time I see you, you are happy."]
 },
 {
	 "id": 956,
	 "label": "some",
	 "phrases": ["I need some milk for my coffee","Can I please have some sugar?","Would you like some tea?","He has some good ideas"]
 },
 {
	 "id": 957,
	 "label": "any",
	 "phrases": ["Do you have any siblings?","I have not received any letters","She did not bring any food for lunch","Are there any messages for me?"]
 },
 {
	 "id": 958,
	 "label": "everything",
	 "phrases": ["Everything in this store is expensive","I have everything I need for my vacation","He lost everything in the fire"]
 },
 {
	 "id": 959,
	 "label": "something",
	 "phrases": ["I have something for you","Can I ask you something?","She is always reading something","Is something wrong with your food?","Let's watching something good on tv tonight"]
 },
 {
	 "id": 960,
	 "label": "anything",
	 "phrases": ["Do you need anything from the grocery store?","I do not want anything for my birthday","She hasn't eaten anything today"]
 },
 {
	 "id": 961,
	 "label": "nothing",
	 "phrases": ["There is nothing to eat","I have nothing to wear for the party","Nothing is scary if you understand it"]
 },
 {
	 "id": 962,
	 "label": "other",
	 "phrases": ["The teacher met with other teachers during lunch","This cake is good, but the other one is better","The other dog is bigger than mine","The other students are in class now"]
 },
 {
	 "id": 963,
	 "label": "another",
	 "phrases": ["I would like another slice of cake please","She is moving to another city for her job","I need another cup of coffee so I don't fall asleep"]
 },
 {
	 "id": 964,
	 "label": "each",
	 "phrases": ["Each student received a book","Please water each plant","They each have their own room in the house","Each day here is a good day"]
 },
 {
	 "id": 965,
	 "label": "thirteen",
	 "phrases": ["Her family moved to Japan when she was 13","He hurt himself on Friday 13th"]
 },
 {
	 "id": 966,
	 "label": "fourteen",
	 "phrases": ["She fell in love with baseball when she was 14"]
 },
 {
	 "id": 967,
	 "label": "fifteen",
	 "phrases": ["He started helping the library when he was 15"]
 },
 {
	 "id": 968,
	 "label": "sixteen",
	 "phrases": ["He learnt how to drive when he was 16"]
 },
 {
	 "id": 969,
	 "label": "seventeen",
	 "phrases": ["She learnt how to drive when she was 17"]
 },
 {
	 "id": 970,
	 "label": "eighteen",
	 "phrases": ["She finished school when she was 18"]
 },
 {
	 "id": 971,
	 "label": "nineteen",
	 "phrases": ["He finished school when he was 19"]
 },
 {
	 "id": 972,
	 "label": "twenty",
	 "phrases": ["He went to American when he was 20"]
 },
 {
	 "id": 973,
	 "label": "twenty-one",
	 "phrases": ["He started working as a chef when he was 21"]
 },
 {
	 "id": 974,
	 "label": "twenty-two",
	 "phrases": ["She started working as a librarian when she was 22"]
 },
 {
	 "id": 975,
	 "label": "twenty-three",
	 "phrases": ["She started studying to be a doctor when she was 23"]
 },
 {
	 "id": 976,
	 "label": "twenty-four",
	 "phrases": ["He started studying to be a doctor when he was 24","There are 24 hours in the day"]
 },
 {
	 "id": 977,
	 "label": "first",
	 "phrases": ["The is the first time I've been in France","My first car was green","Is this your first job?","She came in first in the race"]
 },
 {
	 "id": 978,
	 "label": "second",
	 "phrases": ["After yellow, my second favorite color is green","He was the second person to climb the mountain","I need a second cup of coffee"]
 },
 {
	 "id": 979,
	 "label": "pair",
	 "phrases": ["Those pair of shoes look good","Do you like these pair of pants?","I found a pair of cats outside"]
 },
 {
	 "id": 980,
	 "label": "both",
	 "phrases": ["Both of us went to the game last night","Both dogs are sleeping on the couch","We both love to travel","They both have blue eyes","He was both happy and sad that school was finished"]
 },
 {
	 "id": 981,
	 "label": "always",
	 "phrases": ["I always wake up at 6 a.m.","My dad always drinks coffee in the morning","We always go to church on Sundays","I always read a book before I go to sleep"]
 },
 {
	 "id": 982,
	 "label": "usually",
	 "phrases": ["She usually has lunch at 1 pm","He usually takes the bus to go to work","The park usually has a lot of people on weekends"]
 },
 {
	 "id": 983,
	 "label": "often",
	 "phrases": ["I often walk my dog in the park","She often forgets her keys","They often go to the beach in the summer"]
 },
 {
	 "id": 984,
	 "label": "once",
	 "phrases": ["I once visited India with my family","He once had a small orange cat","Once a week, she cleans the house","I once met a famous singer in Japan"]
 },
 {
	 "id": 985,
	 "label": "never",
	 "phrases": ["I have never been to Australia","He has never eaten a burger before","The boy has never seen snow","I never drink coffee after 6 pm"]
 },
 {
	 "id": 986,
	 "label": "maybe",
	 "phrases": ["Maybe we can go to the park tomorrow","Maybe it will rain today","I am not hungry. Maybe I will eat later.","Maybe I will go to Spain for my next vacation"]
 },
 {
	 "id": 1091,
	 "label": "family",
	 "phrases": ["How many people are in your family?","Her family lives in India","Our family is going on vacation","We are having a family dinner tonight"]
 },
 {
	 "id": 1092,
	 "label": "baby",
	 "phrases": ["The baby is sleeping","She gave the baby a bottle of milk","The baby has big blue eyes"]
 },
 {
	 "id": 1093,
	 "label": "everyone",
	 "phrases": ["Everyone is excited for the trip","He thanked everyone for their help","Everyone is watching the game","Everyone in his family likes to swim"]
 },
 {
	 "id": 1094,
	 "label": "everybody",
	 "phrases": ["Everybody needs to eat","Everybody works hard in this class","Everybody arrived before 10 am"]
 },
 {
	 "id": 1095,
	 "label": "anyone",
	 "phrases": ["Does anyone have a pen?","Anyone can learn English","I have not seen anyone today"]
 },
 {
	 "id": 1096,
	 "label": "someone",
	 "phrases": ["Someone is at the door","Can someone help me with this?","Someone left their phone on the table","That woman is waiting for someone"]
 },
 {
	 "id": 1097,
	 "label": "dear",
	 "phrases": ["My dear friend came to visit me today","This letter is to my dear mother","I wrote a letter to my dear sister","Thank you for helping me my dear"]
 },
 {
	 "id": 1098,
	 "label": "own",
	 "phrases": ["Do you have your own car?","We have our own vegetable garden in the backyard","He writes his own music","She owns her house","Your life is your own"]
 },
 {
	 "id": 1099,
	 "label": "together",
	 "phrases": ["We went to the museum together","They play football together on Thursdays","We are going to Australia together next month"]
 },
 {
	 "id": 1100,
	 "label": "worker",
	 "phrases": ["That man is a hard worker","The construction worker is building a house","The worker in the store helped me find what I needed","He is an office worker","The factory worker is using the machine"]
 },
 {
	 "id": 1101,
	 "label": "writer",
	 "phrases": ["That woman is a famous writer","She is a writer for the town's newspaper","The writer wrote a wonderful book"]
 },
 {
	 "id": 1102,
	 "label": "actor",
	 "phrases": ["I saw a famous actor at that restaurant","This actor is in many tv shows","Have you seen any movies with that actor before?"]
 },
 {
	 "id": 1103,
	 "label": "waiter",
	 "phrases": ["The waiter gave her her food","We asked the waiter for the bill","The waiter brought our drinks to the table","The waiter is cleaning the tables"]
 },
 {
	 "id": 1104,
	 "label": "player",
	 "phrases": ["She is a tennis player","He is a famous piano player","The player kicked the ball","I have been a video game player for a long time"]
 },
 {
	 "id": 1105,
	 "label": "reader",
	 "phrases": ["He is a slow reader, but he enjoys it","The library had a meeting for all the book's readers","As a reader, he always has many books in his bag"]
 },
 {
	 "id": 1106,
	 "label": "grandpa",
	 "phrases": []
 },
 {
	 "id": 1107,
	 "label": "paternal grandpa",
	 "phrases": ["My father's father is my grandpa. He likes to go fishing."]
 },
 {
	 "id": 1108,
	 "label": "maternal grandpa",
	 "phrases": ["My mother's father is my grandpa. He likes to watch tv."]
 },
 {
	 "id": 1109,
	 "label": "grandma",
	 "phrases": []
 },
 {
	 "id": 1110,
	 "label": "paternal grandma",
	 "phrases": ["My father's mother is my grandma. She likes to grow flowers."]
 },
 {
	 "id": 1111,
	 "label": "maternal grandma",
	 "phrases": ["My mother's mother is my grandma. She likes to cook food."]
 },
 {
	 "id": 1112,
	 "label": "it",
	 "phrases": ["It is a beautiful day today","I have a dog and it is very friendly","I liked the movie, it was very funny.","She found a pen, but it does not work."]
 },
 {
	 "id": 1113,
	 "label": "its",
	 "phrases": ["The restaurant is famous for its noodles","The flower has lost its color","The dog is running in its house","The bird is flying to its home"]
 },
 {
	 "id": 1114,
	 "label": "self",
	 "phrases": []
 },
 {
	 "id": 1115,
	 "label": "myself",
	 "phrases": ["I did all the work myself","I like to read books by myself"]
 },
 {
	 "id": 1116,
	 "label": "yourself",
	 "phrases": ["Take care of yourself","Did you make this cake yourself?"]
 },
 {
	 "id": 1117,
	 "label": "themself",
	 "phrases": ["That person made themself a cup of coffee"]
 },
 {
	 "id": 1118,
	 "label": "himself",
	 "phrases": ["He built the house by himself"]
 },
 {
	 "id": 1119,
	 "label": "herself",
	 "phrases": ["She found herself lost in the new city"]
 },
 {
	 "id": 1120,
	 "label": "itself",
	 "phrases": ["The cat washed itself","The door closed by itself","The car drove itself"]
 },
 {
	 "id": 1121,
	 "label": "ourselves",
	 "phrases": ["We made the cake ourselves","We painted the house ourselves"]
 },
 {
	 "id": 1122,
	 "label": "themselves",
	 "phrases": ["They made the dinner themselves","They taught themselves how to play basketball"]
 },
 {
	 "id": 1123,
	 "label": "discuss",
	 "phrases": ["The teacher asked the students to discuss the book","Can I discuss my ideas with you?","I discussed my mom's health with the doctor"]
 },
 {
	 "id": 1124,
	 "label": "describe",
	 "phrases": ["Can you describe your house for me?","Please describe the woman that took your wallet","My young brother is describing his favorite animal"]
 },
 {
	 "id": 1125,
	 "label": "check",
	 "phrases": ["The teacher checked the student's work","The doctor checked her health","Can you check the time for me?"]
 },
 {
	 "id": 1126,
	 "label": "agree",
	 "phrases": ["I agree with your plan","We agree that it's a good idea","She did not agree to sell their house","They did not agree on the date of the meeting"]
 },
 {
	 "id": 1127,
	 "label": "design",
	 "phrases": ["I like the design of this house","The dress has a nice design","He designs buildings for work"]
 },
 {
	 "id": 1128,
	 "label": "plan",
	 "phrases": ["Do you have any plans this weekend?","We need to plan our trip to Australia","What is your plan for today?","They are planning to buy a new house"]
 },
 {
	 "id": 1129,
	 "label": "imagine",
	 "phrases": ["I can not imagine living without meat","He imagines having a dog","Can you imagine a world without music?","He imagines living in a big city one day"]
 },
 {
	 "id": 1130,
	 "label": "begin",
	 "phrases": ["They will begin their trip tomorrow","She begins her day with a cup of tea","Let's begin the meeting now","The movie will begin in 10 minutes"]
 },
 {
	 "id": 1131,
	 "label": "finish",
	 "phrases": ["Have you finished your homework?","He just finished reading the book","She finishes work at 5 pm"]
 },
 {
	 "id": 1132,
	 "label": "welcome",
	 "phrases": ["Welcome to our home!","Everyone is welcome to the party","The teacher welcomed the new student to the class"]
 },
 {
	 "id": 1133,
	 "label": "introduce",
	 "phrases": ["I will introduce you to my friend","The teacher asked the new student to introduce himself","She will introduce her family to him later"]
 },
 {
	 "id": 1134,
	 "label": "build",
	 "phrases": ["They are building a new library in our town","I want to build a tree house","He builds trains for work"]
 },
 {
	 "id": 1135,
	 "label": "break",
	 "phrases": ["My car broke down on the road","He broke his leg playing football","The man broke into the house last night","She broke the glass window"]
 },
 {
	 "id": 1136,
	 "label": "grow",
	 "phrases": ["I want to grow my own vegetables","Her hair grows very fast","The trees grow very big in the park"]
 },
 {
	 "id": 1137,
	 "label": "exercise",
	 "phrases": ["I exercise every morning","Exercising every day is good for your health","She does not have time to exercise"]
 },
 {
	 "id": 1138,
	 "label": "spend",
	 "phrases": ["How much did you spend on the gif?","He likes spending money on food","She spends a lot of time studying","I spend my weekends reading books","We spent the day at the beach"]
 },
 {
	 "id": 1139,
	 "label": "choose",
	 "phrases": ["He chose the blue shirt","She chose to go to school in Japan","I can not choose between these two dresses","Help me choose one of these two shirts"]
 },
 {
	 "id": 1140,
	 "label": "point",
	 "phrases": ["He pointed to the man who took his wallet","The teacher pointed at the word","Can you point me towards the hospital?"]
 },
 {
	 "id": 1141,
	 "label": "fill",
	 "phrases": ["Please, fill this form.","He filled the cup with tea","He filled the shopping bag with fruit"]
 },
 {
	 "id": 1142,
	 "label": "wake",
	 "phrases": ["I wake up at 7:30 am","The loud noise woke him up","Please wake up at 8 am"]
 },
 {
	 "id": 1143,
	 "label": "noise",
	 "phrases": ["The noise is coming from the construction site","The children are making a lot of noise","The cat was woken by the loud noise"]
 },
 {
	 "id": 1144,
	 "label": "sound",
	 "phrases": ["The bird makes a beautiful sound","I heard the sound of laughter","The sound of rain is nice","Please turn up the sound on the tv"]
 },
 {
	 "id": 1145,
	 "label": "add",
	 "phrases": ["Can you add sugar to the coffee please?","Add your name to the list","I forgot to add eggs to the recipe"]
 },
 {
	 "id": 1146,
	 "label": "post",
	 "phrases": ["She posted the letter yesterday","He posted his picture online","I saw your post online"]
 },
 {
	 "id": 1147,
	 "label": "share",
	 "phrases": ["Can you share your homework with me?","He shared a story with the class","We shared the cost of the holiday","They shared a pizza for dinner"]
 },
 {
	 "id": 1148,
	 "label": "pizza",
	 "phrases": ["I love eating pizza","The pizza is too hot to eat","He likes to have lots of cheese on the pizza"]
 },
 {
	 "id": 1149,
	 "label": "keep",
	 "phrases": ["I keep my keys in my bag","Please keep the room clean","She keeps her money in the bank","He keeps a dog at home"]
 },
 {
	 "id": 1150,
	 "label": "miss",
	 "phrases": ["Did I miss the bus?","He missed the last train","I miss my home","She misses her mom"]
 },
 {
	 "id": 1151,
	 "label": "join",
	 "phrases": ["He will join us for dinner","She wants to join the club","They joined the gym together","I asked my friend to join the party"]
 },
 {
	 "id": 1152,
	 "label": "laundromat",
	 "phrases": ["I go to the laundromat to wash my clothes","She forgot her socks at the laundromat","The laundromat is open until 11pm"]
 },
 {
	 "id": 1153,
	 "label": "online",
	 "phrases": ["I usually shop online","She is learning French online","He met his friends online","They are playing games together online"]
 }
]

// Note: Still includes concept_ids where phrases were empty (e.g. grandpa (whereas maternal/paternal grandpa weren't empty))
export const cefrTopicEntries: CEFRTopicEntry[] = [
 {
	 "id": 1028,
	 "topic": "5; People",
	 "topic_order": 947,
	 "concept_id": 1103
 },
 {
	 "id": 1029,
	 "topic": "5; People",
	 "topic_order": 948,
	 "concept_id": 1104
 },
 {
	 "id": 1030,
	 "topic": "5; People",
	 "topic_order": 949,
	 "concept_id": 1105
 },
 {
	 "id": 1031,
	 "topic": "5; People",
	 "topic_order": 950,
	 "concept_id": 1106
 },
 {
	 "id": 1032,
	 "topic": "5; People",
	 "topic_order": 951,
	 "concept_id": 1107
 },
 {
	 "id": 1033,
	 "topic": "5; People",
	 "topic_order": 952,
	 "concept_id": 1108
 },
 {
	 "id": 1034,
	 "topic": "5; People",
	 "topic_order": 953,
	 "concept_id": 1109
 },
 {
	 "id": 1035,
	 "topic": "5; People",
	 "topic_order": 954,
	 "concept_id": 1110
 },
 {
	 "id": 1036,
	 "topic": "5; People",
	 "topic_order": 955,
	 "concept_id": 1111
 },
 {
	 "id": 1037,
	 "topic": "5; People",
	 "topic_order": 956,
	 "concept_id": 1112
 },
 {
	 "id": 1038,
	 "topic": "5; People",
	 "topic_order": 957,
	 "concept_id": 1113
 },
 {
	 "id": 1039,
	 "topic": "5; People",
	 "topic_order": 958,
	 "concept_id": 1114
 },
 {
	 "id": 1040,
	 "topic": "5; People",
	 "topic_order": 959,
	 "concept_id": 1115
 },
 {
	 "id": 1041,
	 "topic": "5; People",
	 "topic_order": 960,
	 "concept_id": 1116
 },
 {
	 "id": 1042,
	 "topic": "5; People",
	 "topic_order": 961,
	 "concept_id": 1117
 },
 {
	 "id": 1043,
	 "topic": "5; People",
	 "topic_order": 962,
	 "concept_id": 1118
 },
 {
	 "id": 1044,
	 "topic": "5; People",
	 "topic_order": 963,
	 "concept_id": 1119
 },
 {
	 "id": 1045,
	 "topic": "5; People",
	 "topic_order": 964,
	 "concept_id": 1120
 },
 {
	 "id": 1046,
	 "topic": "5; People",
	 "topic_order": 965,
	 "concept_id": 1121
 },
 {
	 "id": 1047,
	 "topic": "5; People",
	 "topic_order": 966,
	 "concept_id": 1122
 },
 {
	 "id": 1048,
	 "topic": "1; Basics",
	 "topic_order": 164,
	 "concept_id": 212
 },
 {
	 "id": 1049,
	 "topic": "1; Basics",
	 "topic_order": 165,
	 "concept_id": 213
 },
 {
	 "id": 1050,
	 "topic": "1; Basics",
	 "topic_order": 166,
	 "concept_id": 214
 },
 {
	 "id": 1051,
	 "topic": "1; Basics",
	 "topic_order": 167,
	 "concept_id": 215
 },
 {
	 "id": 1052,
	 "topic": "1; Basics",
	 "topic_order": 168,
	 "concept_id": 216
 },
 {
	 "id": 1053,
	 "topic": "1; Basics",
	 "topic_order": 169,
	 "concept_id": 217
 },
 {
	 "id": 1054,
	 "topic": "1; Basics",
	 "topic_order": 170,
	 "concept_id": 218
 },
 {
	 "id": 1055,
	 "topic": "1; Basics",
	 "topic_order": 171,
	 "concept_id": 219
 },
 {
	 "id": 1056,
	 "topic": "1; Basics",
	 "topic_order": 172,
	 "concept_id": 220
 },
 {
	 "id": 1057,
	 "topic": "1; Basics",
	 "topic_order": 173,
	 "concept_id": 221
 },
 {
	 "id": 1058,
	 "topic": "1; Basics",
	 "topic_order": 174,
	 "concept_id": 222
 },
 {
	 "id": 1059,
	 "topic": "1; Basics",
	 "topic_order": 175,
	 "concept_id": 223
 },
 {
	 "id": 1060,
	 "topic": "1; Basics",
	 "topic_order": 176,
	 "concept_id": 224
 },
 {
	 "id": 1061,
	 "topic": "1; Basics",
	 "topic_order": 177,
	 "concept_id": 225
 },
 {
	 "id": 1062,
	 "topic": "1; Basics",
	 "topic_order": 178,
	 "concept_id": 226
 },
 {
	 "id": 1063,
	 "topic": "1; Basics",
	 "topic_order": 179,
	 "concept_id": 227
 },
 {
	 "id": 1064,
	 "topic": "1; Basics",
	 "topic_order": 180,
	 "concept_id": 228
 },
 {
	 "id": 1065,
	 "topic": "1; Basics",
	 "topic_order": 181,
	 "concept_id": 229
 },
 {
	 "id": 1066,
	 "topic": "1; Basics",
	 "topic_order": 182,
	 "concept_id": 230
 },
 {
	 "id": 1067,
	 "topic": "1; Basics",
	 "topic_order": 183,
	 "concept_id": 231
 },
 {
	 "id": 1068,
	 "topic": "1; Basics",
	 "topic_order": 184,
	 "concept_id": 232
 },
 {
	 "id": 1069,
	 "topic": "1; Basics",
	 "topic_order": 185,
	 "concept_id": 233
 },
 {
	 "id": 1070,
	 "topic": "1; Basics",
	 "topic_order": 186,
	 "concept_id": 234
 },
 {
	 "id": 1071,
	 "topic": "1; Basics",
	 "topic_order": 187,
	 "concept_id": 235
 },
 {
	 "id": 1072,
	 "topic": "1; Basics",
	 "topic_order": 188,
	 "concept_id": 236
 },
 {
	 "id": 1073,
	 "topic": "1; Basics",
	 "topic_order": 189,
	 "concept_id": 237
 },
 {
	 "id": 1074,
	 "topic": "1; Basics",
	 "topic_order": 190,
	 "concept_id": 238
 },
 {
	 "id": 1075,
	 "topic": "1; Basics",
	 "topic_order": 191,
	 "concept_id": 239
 },
 {
	 "id": 1076,
	 "topic": "1; Basics",
	 "topic_order": 192,
	 "concept_id": 240
 },
 {
	 "id": 1077,
	 "topic": "1; Basics",
	 "topic_order": 193,
	 "concept_id": 241
 },
 {
	 "id": 1078,
	 "topic": "1; Basics",
	 "topic_order": 194,
	 "concept_id": 242
 },
 {
	 "id": 1079,
	 "topic": "1; Basics",
	 "topic_order": 195,
	 "concept_id": 243
 },
 {
	 "id": 1080,
	 "topic": "1; Basics",
	 "topic_order": 196,
	 "concept_id": 244
 },
 {
	 "id": 1081,
	 "topic": "1; Basics",
	 "topic_order": 197,
	 "concept_id": 245
 },
 {
	 "id": 1082,
	 "topic": "1; Basics",
	 "topic_order": 198,
	 "concept_id": 246
 },
 {
	 "id": 1083,
	 "topic": "1; Basics",
	 "topic_order": 199,
	 "concept_id": 247
 },
 {
	 "id": 1084,
	 "topic": "1; Basics",
	 "topic_order": 200,
	 "concept_id": 248
 },
 {
	 "id": 1085,
	 "topic": "1; Basics",
	 "topic_order": 201,
	 "concept_id": 249
 },
 {
	 "id": 1086,
	 "topic": "1; Basics",
	 "topic_order": 202,
	 "concept_id": 250
 },
 {
	 "id": 1087,
	 "topic": "1; Basics",
	 "topic_order": 203,
	 "concept_id": 251
 },
 {
	 "id": 1088,
	 "topic": "1; Basics",
	 "topic_order": 204,
	 "concept_id": 252
 },
 {
	 "id": 1089,
	 "topic": "1; Basics",
	 "topic_order": 205,
	 "concept_id": 253
 },
 {
	 "id": 1090,
	 "topic": "1; Basics",
	 "topic_order": 206,
	 "concept_id": 254
 },
 {
	 "id": 1091,
	 "topic": "1; Basics",
	 "topic_order": 207,
	 "concept_id": 255
 },
 {
	 "id": 1092,
	 "topic": "1; Basics",
	 "topic_order": 208,
	 "concept_id": 256
 },
 {
	 "id": 1093,
	 "topic": "1; Basics",
	 "topic_order": 209,
	 "concept_id": 257
 },
 {
	 "id": 1094,
	 "topic": "1; Basics",
	 "topic_order": 210,
	 "concept_id": 258
 },
 {
	 "id": 1095,
	 "topic": "1; Basics",
	 "topic_order": 211,
	 "concept_id": 259
 },
 {
	 "id": 1096,
	 "topic": "1; Basics",
	 "topic_order": 212,
	 "concept_id": 260
 },
 {
	 "id": 1097,
	 "topic": "1; Basics",
	 "topic_order": 213,
	 "concept_id": 261
 },
 {
	 "id": 1098,
	 "topic": "1; Basics",
	 "topic_order": 214,
	 "concept_id": 262
 },
 {
	 "id": 1099,
	 "topic": "1; Basics",
	 "topic_order": 215,
	 "concept_id": 263
 },
 {
	 "id": 1100,
	 "topic": "1; Basics",
	 "topic_order": 216,
	 "concept_id": 264
 },
 {
	 "id": 1101,
	 "topic": "1; Basics",
	 "topic_order": 217,
	 "concept_id": 265
 },
 {
	 "id": 1102,
	 "topic": "1; Basics",
	 "topic_order": 218,
	 "concept_id": 266
 },
 {
	 "id": 1103,
	 "topic": "1; Basics",
	 "topic_order": 219,
	 "concept_id": 267
 },
 {
	 "id": 1104,
	 "topic": "1; Basics",
	 "topic_order": 220,
	 "concept_id": 268
 },
 {
	 "id": 1105,
	 "topic": "1; Basics",
	 "topic_order": 221,
	 "concept_id": 269
 },
 {
	 "id": 1106,
	 "topic": "1; Basics",
	 "topic_order": 222,
	 "concept_id": 270
 },
 {
	 "id": 1107,
	 "topic": "1; Basics",
	 "topic_order": 223,
	 "concept_id": 271
 },
 {
	 "id": 1108,
	 "topic": "1; Basics",
	 "topic_order": 224,
	 "concept_id": 272
 },
 {
	 "id": 1109,
	 "topic": "1; Basics",
	 "topic_order": 225,
	 "concept_id": 273
 },
 {
	 "id": 1110,
	 "topic": "1; Basics",
	 "topic_order": 226,
	 "concept_id": 274
 },
 {
	 "id": 1111,
	 "topic": "1; Basics",
	 "topic_order": 227,
	 "concept_id": 275
 },
 {
	 "id": 1112,
	 "topic": "1; Basics",
	 "topic_order": 228,
	 "concept_id": 276
 },
 {
	 "id": 1113,
	 "topic": "1; Basics",
	 "topic_order": 229,
	 "concept_id": 277
 },
 {
	 "id": 1114,
	 "topic": "1; Basics",
	 "topic_order": 230,
	 "concept_id": 278
 },
 {
	 "id": 1115,
	 "topic": "1; Basics",
	 "topic_order": 231,
	 "concept_id": 279
 },
 {
	 "id": 1116,
	 "topic": "1; Basics",
	 "topic_order": 232,
	 "concept_id": 280
 },
 {
	 "id": 1117,
	 "topic": "1; Basics",
	 "topic_order": 233,
	 "concept_id": 281
 },
 {
	 "id": 1118,
	 "topic": "1; Basics",
	 "topic_order": 234,
	 "concept_id": 282
 },
 {
	 "id": 1119,
	 "topic": "1; Basics",
	 "topic_order": 235,
	 "concept_id": 283
 },
 {
	 "id": 1120,
	 "topic": "1; Basics",
	 "topic_order": 236,
	 "concept_id": 284
 },
 {
	 "id": 1121,
	 "topic": "1; Basics",
	 "topic_order": 237,
	 "concept_id": 285
 },
 {
	 "id": 1122,
	 "topic": "1; Basics",
	 "topic_order": 238,
	 "concept_id": 286
 },
 {
	 "id": 1123,
	 "topic": "1; Basics",
	 "topic_order": 239,
	 "concept_id": 287
 },
 {
	 "id": 1124,
	 "topic": "1; Basics",
	 "topic_order": 240,
	 "concept_id": 288
 },
 {
	 "id": 1125,
	 "topic": "1; Basics",
	 "topic_order": 241,
	 "concept_id": 289
 },
 {
	 "id": 1126,
	 "topic": "1; Basics",
	 "topic_order": 242,
	 "concept_id": 290
 },
 {
	 "id": 1127,
	 "topic": "1; Basics",
	 "topic_order": 243,
	 "concept_id": 291
 },
 {
	 "id": 1128,
	 "topic": "1; Basics",
	 "topic_order": 244,
	 "concept_id": 292
 },
 {
	 "id": 1129,
	 "topic": "1; Basics",
	 "topic_order": 245,
	 "concept_id": 293
 },
 {
	 "id": 1130,
	 "topic": "1; Basics",
	 "topic_order": 246,
	 "concept_id": 294
 },
 {
	 "id": 1131,
	 "topic": "1; Basics",
	 "topic_order": 247,
	 "concept_id": 295
 },
 {
	 "id": 1132,
	 "topic": "1; Basics",
	 "topic_order": 248,
	 "concept_id": 296
 },
 {
	 "id": 1133,
	 "topic": "1; Basics",
	 "topic_order": 249,
	 "concept_id": 297
 },
 {
	 "id": 1134,
	 "topic": "1; Basics",
	 "topic_order": 250,
	 "concept_id": 298
 },
 {
	 "id": 1135,
	 "topic": "1; Basics",
	 "topic_order": 251,
	 "concept_id": 299
 },
 {
	 "id": 1136,
	 "topic": "1; Basics",
	 "topic_order": 252,
	 "concept_id": 300
 },
 {
	 "id": 1137,
	 "topic": "1; Basics",
	 "topic_order": 253,
	 "concept_id": 301
 },
 {
	 "id": 1138,
	 "topic": "1; Basics",
	 "topic_order": 254,
	 "concept_id": 302
 },
 {
	 "id": 1139,
	 "topic": "1; Basics",
	 "topic_order": 255,
	 "concept_id": 303
 },
 {
	 "id": 1140,
	 "topic": "1; Basics",
	 "topic_order": 256,
	 "concept_id": 304
 },
 {
	 "id": 1141,
	 "topic": "1; Basics",
	 "topic_order": 257,
	 "concept_id": 305
 },
 {
	 "id": 1142,
	 "topic": "1; Basics",
	 "topic_order": 258,
	 "concept_id": 306
 },
 {
	 "id": 1143,
	 "topic": "1; Basics",
	 "topic_order": 259,
	 "concept_id": 307
 },
 {
	 "id": 1144,
	 "topic": "1; Basics",
	 "topic_order": 260,
	 "concept_id": 308
 },
 {
	 "id": 1145,
	 "topic": "2; 1F: Family",
	 "topic_order": 3,
	 "concept_id": 26
 },
 {
	 "id": 1146,
	 "topic": "2; 1F: Family",
	 "topic_order": 4,
	 "concept_id": 27
 },
 {
	 "id": 1147,
	 "topic": "2; 1F: Family",
	 "topic_order": 5,
	 "concept_id": 28
 },
 {
	 "id": 1148,
	 "topic": "2; 1F: Family",
	 "topic_order": 6,
	 "concept_id": 29
 },
 {
	 "id": 1149,
	 "topic": "2; 1F: Family",
	 "topic_order": 7,
	 "concept_id": 30
 },
 {
	 "id": 1150,
	 "topic": "2; 1F: Family",
	 "topic_order": 8,
	 "concept_id": 31
 },
 {
	 "id": 1151,
	 "topic": "2; 1F: Family",
	 "topic_order": 9,
	 "concept_id": 32
 },
 {
	 "id": 1152,
	 "topic": "2; 1F: Family",
	 "topic_order": 10,
	 "concept_id": 33
 },
 {
	 "id": 1153,
	 "topic": "2; 1F: Family",
	 "topic_order": 11,
	 "concept_id": 34
 },
 {
	 "id": 1154,
	 "topic": "2; 1P: Meeting People",
	 "topic_order": 1,
	 "concept_id": 1
 },
 {
	 "id": 1155,
	 "topic": "2; 1P: Meeting People",
	 "topic_order": 2,
	 "concept_id": 2
 },
 {
	 "id": 1156,
	 "topic": "2; 1P: Meeting People",
	 "topic_order": 3,
	 "concept_id": 3
 },
 {
	 "id": 1157,
	 "topic": "2; 1P: Meeting People",
	 "topic_order": 4,
	 "concept_id": 4
 },
 {
	 "id": 1158,
	 "topic": "2; 1P: Meeting People",
	 "topic_order": 5,
	 "concept_id": 5
 },
 {
	 "id": 1159,
	 "topic": "2; 1P: Meeting People",
	 "topic_order": 6,
	 "concept_id": 6
 },
 {
	 "id": 1160,
	 "topic": "2; 1P: Meeting People",
	 "topic_order": 7,
	 "concept_id": 7
 },
 {
	 "id": 1161,
	 "topic": "2; 1P: Meeting People",
	 "topic_order": 8,
	 "concept_id": 8
 },
 {
	 "id": 1162,
	 "topic": "2; 1P: Meeting People",
	 "topic_order": 9,
	 "concept_id": 9
 },
 {
	 "id": 1163,
	 "topic": "2; 1P: Meeting People",
	 "topic_order": 10,
	 "concept_id": 10
 },
 {
	 "id": 1164,
	 "topic": "2; 1P: Meeting People",
	 "topic_order": 11,
	 "concept_id": 11
 },
 {
	 "id": 1165,
	 "topic": "2; 1P: Meeting People",
	 "topic_order": 12,
	 "concept_id": 12
 },
 {
	 "id": 1166,
	 "topic": "2; 1P: Meeting People",
	 "topic_order": 13,
	 "concept_id": 13
 },
 {
	 "id": 1167,
	 "topic": "2; 1P: Meeting People",
	 "topic_order": 14,
	 "concept_id": 14
 },
 {
	 "id": 1168,
	 "topic": "2; 1P: Meeting People",
	 "topic_order": 15,
	 "concept_id": 15
 },
 {
	 "id": 1169,
	 "topic": "2; 1P: Meeting People",
	 "topic_order": 16,
	 "concept_id": 16
 },
 {
	 "id": 1170,
	 "topic": "2; 1P: Meeting People",
	 "topic_order": 17,
	 "concept_id": 17
 },
 {
	 "id": 1171,
	 "topic": "2; 1P: Meeting People",
	 "topic_order": 18,
	 "concept_id": 18
 },
 {
	 "id": 1172,
	 "topic": "2; 1P: Meeting People",
	 "topic_order": 19,
	 "concept_id": 19
 },
 {
	 "id": 1173,
	 "topic": "2; 1P: Meeting People",
	 "topic_order": 20,
	 "concept_id": 20
 },
 {
	 "id": 1174,
	 "topic": "2; 1P: Meeting People",
	 "topic_order": 21,
	 "concept_id": 21
 },
 {
	 "id": 1175,
	 "topic": "2; 1P: Meeting People",
	 "topic_order": 22,
	 "concept_id": 22
 },
 {
	 "id": 1176,
	 "topic": "2; 1T: Travel Basics",
	 "topic_order": 0,
	 "concept_id": 22
 },
 {
	 "id": 1177,
	 "topic": "2; 1T: Travel Basics",
	 "topic_order": 12,
	 "concept_id": 60
 },
 {
	 "id": 1178,
	 "topic": "2; 1T: Travel Basics",
	 "topic_order": 13,
	 "concept_id": 61
 },
 {
	 "id": 1179,
	 "topic": "2; 1T: Travel Basics",
	 "topic_order": 14,
	 "concept_id": 62
 },
 {
	 "id": 1180,
	 "topic": "2; 1T: Travel Basics",
	 "topic_order": 15,
	 "concept_id": 63
 },
 {
	 "id": 1181,
	 "topic": "2; 1T: Travel Basics",
	 "topic_order": 16,
	 "concept_id": 64
 },
 {
	 "id": 1182,
	 "topic": "2; 1T: Travel Basics",
	 "topic_order": 17,
	 "concept_id": 65
 },
 {
	 "id": 1183,
	 "topic": "2; 1T: Travel Basics",
	 "topic_order": 18,
	 "concept_id": 66
 },
 {
	 "id": 1184,
	 "topic": "2; 1T: Travel Basics",
	 "topic_order": 19,
	 "concept_id": 67
 },
 {
	 "id": 1185,
	 "topic": "2; 1T: Travel Basics",
	 "topic_order": 20,
	 "concept_id": 68
 },
 {
	 "id": 1186,
	 "topic": "2; 1T: Travel Basics",
	 "topic_order": 21,
	 "concept_id": 69
 },
 {
	 "id": 1187,
	 "topic": "2; 1T: Travel Basics",
	 "topic_order": 22,
	 "concept_id": 70
 },
 {
	 "id": 1188,
	 "topic": "2; 1T: Travel Basics",
	 "topic_order": 23,
	 "concept_id": 71
 },
 {
	 "id": 1189,
	 "topic": "2; 1T: Travel Basics",
	 "topic_order": 24,
	 "concept_id": 72
 },
 {
	 "id": 1190,
	 "topic": "2; 1T: Travel Basics",
	 "topic_order": 25,
	 "concept_id": 73
 },
 {
	 "id": 1191,
	 "topic": "2; 1T: Travel Basics",
	 "topic_order": 26,
	 "concept_id": 74
 },
 {
	 "id": 1192,
	 "topic": "2; 1T: Travel Basics",
	 "topic_order": 27,
	 "concept_id": 75
 },
 {
	 "id": 1193,
	 "topic": "2; 1T: Travel Basics",
	 "topic_order": 28,
	 "concept_id": 76
 },
 {
	 "id": 1194,
	 "topic": "2; 1T: Travel Basics",
	 "topic_order": 29,
	 "concept_id": 77
 },
 {
	 "id": 1195,
	 "topic": "2; 1T: Travel Basics",
	 "topic_order": 30,
	 "concept_id": 78
 },
 {
	 "id": 1196,
	 "topic": "2; 1T: Travel Basics",
	 "topic_order": 31,
	 "concept_id": 79
 },
 {
	 "id": 1197,
	 "topic": "2; 1T: Travel Basics",
	 "topic_order": 32,
	 "concept_id": 80
 },
 {
	 "id": 1198,
	 "topic": "2; 1T: Travel Basics",
	 "topic_order": 33,
	 "concept_id": 81
 },
 {
	 "id": 1199,
	 "topic": "2; 1T: Travel Basics",
	 "topic_order": 34,
	 "concept_id": 82
 },
 {
	 "id": 1200,
	 "topic": "2; 1T: Travel Basics",
	 "topic_order": 35,
	 "concept_id": 83
 },
 {
	 "id": 1201,
	 "topic": "2; 1T: Travel Basics",
	 "topic_order": 36,
	 "concept_id": 84
 },
 {
	 "id": 1202,
	 "topic": "2; 1T: Travel Basics",
	 "topic_order": 37,
	 "concept_id": 85
 },
 {
	 "id": 1203,
	 "topic": "2; 1T: Travel Basics",
	 "topic_order": 38,
	 "concept_id": 86
 },
 {
	 "id": 1204,
	 "topic": "2; 1T: Travel Basics",
	 "topic_order": 39,
	 "concept_id": 87
 },
 {
	 "id": 1205,
	 "topic": "2; 1T: Travel Basics",
	 "topic_order": 40,
	 "concept_id": 88
 },
 {
	 "id": 1206,
	 "topic": "2; 1T: Travel Basics",
	 "topic_order": 41,
	 "concept_id": 89
 },
 {
	 "id": 1207,
	 "topic": "2; 1T: Travel Basics",
	 "topic_order": 42,
	 "concept_id": 90
 },
 {
	 "id": 1208,
	 "topic": "2; 1T: Travel Basics",
	 "topic_order": 43,
	 "concept_id": 91
 },
 {
	 "id": 1209,
	 "topic": "2; 1T: Travel Basics",
	 "topic_order": 44,
	 "concept_id": 92
 },
 {
	 "id": 1210,
	 "topic": "2; 1T: Travel Basics",
	 "topic_order": 45,
	 "concept_id": 93
 },
 {
	 "id": 1211,
	 "topic": "2; 1T: Travel Basics",
	 "topic_order": 46,
	 "concept_id": 94
 },
 {
	 "id": 1212,
	 "topic": "2; 1T: Travel Basics",
	 "topic_order": 47,
	 "concept_id": 95
 },
 {
	 "id": 1213,
	 "topic": "2; 1T: Travel Basics",
	 "topic_order": 48,
	 "concept_id": 96
 },
 {
	 "id": 1214,
	 "topic": "2; 1T: Travel Basics",
	 "topic_order": 49,
	 "concept_id": 97
 },
 {
	 "id": 1215,
	 "topic": "2; 1T: Travel Basics",
	 "topic_order": 50,
	 "concept_id": 98
 },
 {
	 "id": 1216,
	 "topic": "2; 1T: Travel Basics",
	 "topic_order": 51,
	 "concept_id": 99
 },
 {
	 "id": 1217,
	 "topic": "2; 1T: Travel Basics",
	 "topic_order": 52,
	 "concept_id": 100
 },
 {
	 "id": 1218,
	 "topic": "2; 1T: Travel Basics",
	 "topic_order": 53,
	 "concept_id": 101
 },
 {
	 "id": 1219,
	 "topic": "2; 1T: Travel Basics",
	 "topic_order": 54,
	 "concept_id": 102
 },
 {
	 "id": 1220,
	 "topic": "2; 1T: Travel Basics",
	 "topic_order": 55,
	 "concept_id": 103
 },
 {
	 "id": 1221,
	 "topic": "2; 1T: Travel Basics",
	 "topic_order": 56,
	 "concept_id": 104
 },
 {
	 "id": 1222,
	 "topic": "2; 1T: Travel Basics",
	 "topic_order": 57,
	 "concept_id": 105
 },
 {
	 "id": 1223,
	 "topic": "2; 1T: Travel Basics",
	 "topic_order": 58,
	 "concept_id": 106
 },
 {
	 "id": 1224,
	 "topic": "2; 1T: Travel Basics",
	 "topic_order": 59,
	 "concept_id": 107
 },
 {
	 "id": 1225,
	 "topic": "2; 1T: Travel Basics",
	 "topic_order": 60,
	 "concept_id": 108
 },
 {
	 "id": 1226,
	 "topic": "2; 1T: Travel Basics",
	 "topic_order": 61,
	 "concept_id": 109
 },
 {
	 "id": 1227,
	 "topic": "2; 1T: Travel Basics",
	 "topic_order": 62,
	 "concept_id": 110
 },
 {
	 "id": 1228,
	 "topic": "2; 1T: Travel Basics",
	 "topic_order": 63,
	 "concept_id": 111
 },
 {
	 "id": 1229,
	 "topic": "2; 1T: Travel Basics",
	 "topic_order": 64,
	 "concept_id": 112
 },
 {
	 "id": 1230,
	 "topic": "2; 1T: Travel Basics",
	 "topic_order": 65,
	 "concept_id": 113
 },
 {
	 "id": 1231,
	 "topic": "2; 1T: Travel Basics",
	 "topic_order": 66,
	 "concept_id": 114
 },
 {
	 "id": 1232,
	 "topic": "2; 1T: Travel Basics",
	 "topic_order": 67,
	 "concept_id": 115
 },
 {
	 "id": 1233,
	 "topic": "2; 1T: Travel Basics",
	 "topic_order": 68,
	 "concept_id": 116
 },
 {
	 "id": 1234,
	 "topic": "2; 1T: Travel Basics",
	 "topic_order": 69,
	 "concept_id": 117
 },
 {
	 "id": 1235,
	 "topic": "2; 1T: Travel Basics",
	 "topic_order": 70,
	 "concept_id": 118
 },
 {
	 "id": 1236,
	 "topic": "2; 1T: Travel Basics",
	 "topic_order": 71,
	 "concept_id": 119
 },
 {
	 "id": 1237,
	 "topic": "2; 1T: Travel Basics",
	 "topic_order": 72,
	 "concept_id": 120
 },
 {
	 "id": 1238,
	 "topic": "2; 1T: Travel Basics",
	 "topic_order": 73,
	 "concept_id": 121
 },
 {
	 "id": 1239,
	 "topic": "2; 1T: Travel Basics",
	 "topic_order": 74,
	 "concept_id": 122
 },
 {
	 "id": 1240,
	 "topic": "2; 2F: Siblings",
	 "topic_order": 87,
	 "concept_id": 135
 },
 {
	 "id": 1241,
	 "topic": "2; 2F: Siblings",
	 "topic_order": 88,
	 "concept_id": 136
 },
 {
	 "id": 1242,
	 "topic": "2; 2F: Siblings",
	 "topic_order": 89,
	 "concept_id": 137
 },
 {
	 "id": 1243,
	 "topic": "2; 2F: Siblings",
	 "topic_order": 90,
	 "concept_id": 138
 },
 {
	 "id": 1244,
	 "topic": "2; 2F: Siblings",
	 "topic_order": 91,
	 "concept_id": 139
 },
 {
	 "id": 1245,
	 "topic": "2; 2F: Siblings",
	 "topic_order": 92,
	 "concept_id": 140
 },
 {
	 "id": 1246,
	 "topic": "2; 2F: Siblings",
	 "topic_order": 93,
	 "concept_id": 141
 },
 {
	 "id": 1247,
	 "topic": "2; 2P: Professions",
	 "topic_order": 1,
	 "concept_id": 116
 },
 {
	 "id": 1248,
	 "topic": "2; 2P: Professions",
	 "topic_order": 0,
	 "concept_id": 20
 },
 {
	 "id": 1249,
	 "topic": "2; 2P: Professions",
	 "topic_order": 75,
	 "concept_id": 123
 },
 {
	 "id": 1250,
	 "topic": "2; 2P: Professions",
	 "topic_order": 76,
	 "concept_id": 124
 },
 {
	 "id": 1251,
	 "topic": "2; 2P: Professions",
	 "topic_order": 77,
	 "concept_id": 125
 },
 {
	 "id": 1252,
	 "topic": "2; 2P: Professions",
	 "topic_order": 78,
	 "concept_id": 126
 },
 {
	 "id": 1253,
	 "topic": "2; 2P: Professions",
	 "topic_order": 79,
	 "concept_id": 127
 },
 {
	 "id": 1254,
	 "topic": "2; 2P: Professions",
	 "topic_order": 80,
	 "concept_id": 128
 },
 {
	 "id": 1255,
	 "topic": "2; 2P: Professions",
	 "topic_order": 81,
	 "concept_id": 129
 },
 {
	 "id": 1256,
	 "topic": "2; 2P: Professions",
	 "topic_order": 82,
	 "concept_id": 130
 },
 {
	 "id": 1257,
	 "topic": "2; 2P: Professions",
	 "topic_order": 83,
	 "concept_id": 131
 },
 {
	 "id": 1258,
	 "topic": "2; 2P: Professions",
	 "topic_order": 84,
	 "concept_id": 132
 },
 {
	 "id": 1259,
	 "topic": "2; 2P: Professions",
	 "topic_order": 85,
	 "concept_id": 133
 },
 {
	 "id": 1260,
	 "topic": "2; 2P: Professions",
	 "topic_order": 86,
	 "concept_id": 134
 },
 {
	 "id": 1261,
	 "topic": "2; 2T: Directions",
	 "topic_order": 0,
	 "concept_id": 99
 },
 {
	 "id": 1262,
	 "topic": "2; 2T: Directions",
	 "topic_order": 109,
	 "concept_id": 157
 },
 {
	 "id": 1263,
	 "topic": "2; 2T: Directions",
	 "topic_order": 110,
	 "concept_id": 158
 },
 {
	 "id": 1264,
	 "topic": "2; 2T: Directions",
	 "topic_order": 111,
	 "concept_id": 159
 },
 {
	 "id": 1265,
	 "topic": "2; 2T: Directions",
	 "topic_order": 112,
	 "concept_id": 160
 },
 {
	 "id": 1266,
	 "topic": "2; 2T: Directions",
	 "topic_order": 113,
	 "concept_id": 161
 },
 {
	 "id": 1267,
	 "topic": "2; 2T: Directions",
	 "topic_order": 114,
	 "concept_id": 162
 },
 {
	 "id": 1268,
	 "topic": "2; 2T: Directions",
	 "topic_order": 115,
	 "concept_id": 163
 },
 {
	 "id": 1269,
	 "topic": "2; 2T: Directions",
	 "topic_order": 116,
	 "concept_id": 164
 },
 {
	 "id": 1270,
	 "topic": "2; 2T: Directions",
	 "topic_order": 117,
	 "concept_id": 165
 },
 {
	 "id": 1271,
	 "topic": "2; 2T: Eating Out",
	 "topic_order": 0,
	 "concept_id": 148
 },
 {
	 "id": 1272,
	 "topic": "2; 2T: Eating Out",
	 "topic_order": 118,
	 "concept_id": 166
 },
 {
	 "id": 1273,
	 "topic": "2; 2T: Eating Out",
	 "topic_order": 119,
	 "concept_id": 167
 },
 {
	 "id": 1274,
	 "topic": "2; 2T: Eating Out",
	 "topic_order": 120,
	 "concept_id": 168
 },
 {
	 "id": 1275,
	 "topic": "2; 2T: Eating Out",
	 "topic_order": 121,
	 "concept_id": 169
 },
 {
	 "id": 1276,
	 "topic": "2; 2T: Eating Out",
	 "topic_order": 122,
	 "concept_id": 170
 },
 {
	 "id": 1277,
	 "topic": "2; 2T: Eating Out",
	 "topic_order": 123,
	 "concept_id": 171
 },
 {
	 "id": 1278,
	 "topic": "2; 2T: Eating Out",
	 "topic_order": 124,
	 "concept_id": 172
 },
 {
	 "id": 1279,
	 "topic": "2; 2T: Emergengies",
	 "topic_order": 0,
	 "concept_id": 116
 },
 {
	 "id": 1280,
	 "topic": "2; 2T: Emergengies",
	 "topic_order": 1,
	 "concept_id": 150
 },
 {
	 "id": 1281,
	 "topic": "2; 2T: Emergengies",
	 "topic_order": 2,
	 "concept_id": 166
 },
 {
	 "id": 1282,
	 "topic": "2; 2T: Emergengies",
	 "topic_order": 3,
	 "concept_id": 148
 },
 {
	 "id": 1283,
	 "topic": "2; 2T: Emergengies",
	 "topic_order": 125,
	 "concept_id": 173
 },
 {
	 "id": 1284,
	 "topic": "2; 2T: Emergengies",
	 "topic_order": 126,
	 "concept_id": 174
 },
 {
	 "id": 1285,
	 "topic": "2; 2T: Emergengies",
	 "topic_order": 127,
	 "concept_id": 175
 },
 {
	 "id": 1286,
	 "topic": "2; 2T: Emergengies",
	 "topic_order": 128,
	 "concept_id": 176
 },
 {
	 "id": 1287,
	 "topic": "2; 2T: Emergengies",
	 "topic_order": 129,
	 "concept_id": 177
 },
 {
	 "id": 1288,
	 "topic": "2; 2T: Emergengies",
	 "topic_order": 130,
	 "concept_id": 178
 },
 {
	 "id": 1289,
	 "topic": "2; 2T: Emergengies",
	 "topic_order": 131,
	 "concept_id": 179
 },
 {
	 "id": 1290,
	 "topic": "2; 2T: Emergengies",
	 "topic_order": 132,
	 "concept_id": 180
 },
 {
	 "id": 1291,
	 "topic": "2; 2T: Emergengies",
	 "topic_order": 133,
	 "concept_id": 181
 },
 {
	 "id": 1292,
	 "topic": "2; 2T: Places",
	 "topic_order": 94,
	 "concept_id": 142
 },
 {
	 "id": 1293,
	 "topic": "2; 2T: Places",
	 "topic_order": 95,
	 "concept_id": 143
 },
 {
	 "id": 1294,
	 "topic": "2; 2T: Places",
	 "topic_order": 96,
	 "concept_id": 144
 },
 {
	 "id": 1295,
	 "topic": "2; 2T: Places",
	 "topic_order": 97,
	 "concept_id": 145
 },
 {
	 "id": 1296,
	 "topic": "2; 2T: Places",
	 "topic_order": 98,
	 "concept_id": 146
 },
 {
	 "id": 1297,
	 "topic": "2; 2T: Places",
	 "topic_order": 99,
	 "concept_id": 147
 },
 {
	 "id": 1298,
	 "topic": "2; 2T: Places",
	 "topic_order": 100,
	 "concept_id": 148
 },
 {
	 "id": 1299,
	 "topic": "2; 2T: Places",
	 "topic_order": 101,
	 "concept_id": 149
 },
 {
	 "id": 1300,
	 "topic": "2; 2T: Places",
	 "topic_order": 102,
	 "concept_id": 150
 },
 {
	 "id": 1301,
	 "topic": "2; 2T: Places",
	 "topic_order": 103,
	 "concept_id": 151
 },
 {
	 "id": 1302,
	 "topic": "2; 2T: Places",
	 "topic_order": 104,
	 "concept_id": 152
 },
 {
	 "id": 1303,
	 "topic": "2; 2T: Places",
	 "topic_order": 105,
	 "concept_id": 153
 },
 {
	 "id": 1304,
	 "topic": "2; 2T: Places",
	 "topic_order": 106,
	 "concept_id": 154
 },
 {
	 "id": 1305,
	 "topic": "2; 2T: Places",
	 "topic_order": 107,
	 "concept_id": 155
 },
 {
	 "id": 1306,
	 "topic": "2; 2T: Places",
	 "topic_order": 108,
	 "concept_id": 156
 },
 {
	 "id": 1307,
	 "topic": "2; 2T: Time",
	 "topic_order": 0,
	 "concept_id": 105
 },
 {
	 "id": 1308,
	 "topic": "2; 2T: Time",
	 "topic_order": 134,
	 "concept_id": 182
 },
 {
	 "id": 1309,
	 "topic": "2; 2T: Time",
	 "topic_order": 135,
	 "concept_id": 183
 },
 {
	 "id": 1310,
	 "topic": "2; 2T: Time",
	 "topic_order": 136,
	 "concept_id": 184
 },
 {
	 "id": 1311,
	 "topic": "2; 2T: Time",
	 "topic_order": 137,
	 "concept_id": 185
 },
 {
	 "id": 1312,
	 "topic": "2; 2T: Time",
	 "topic_order": 138,
	 "concept_id": 186
 },
 {
	 "id": 1313,
	 "topic": "2; 2T: Time",
	 "topic_order": 139,
	 "concept_id": 187
 },
 {
	 "id": 1314,
	 "topic": "2; 2T: Time",
	 "topic_order": 140,
	 "concept_id": 188
 },
 {
	 "id": 1315,
	 "topic": "2; 2T: Time",
	 "topic_order": 141,
	 "concept_id": 189
 },
 {
	 "id": 1316,
	 "topic": "2; 2T: Time",
	 "topic_order": 142,
	 "concept_id": 190
 },
 {
	 "id": 1317,
	 "topic": "2; 2T: Time",
	 "topic_order": 143,
	 "concept_id": 191
 },
 {
	 "id": 1318,
	 "topic": "2; 2T: Time",
	 "topic_order": 144,
	 "concept_id": 192
 },
 {
	 "id": 1319,
	 "topic": "2; 2T: Time",
	 "topic_order": 145,
	 "concept_id": 193
 },
 {
	 "id": 1320,
	 "topic": "2; 2T: Time",
	 "topic_order": 146,
	 "concept_id": 194
 },
 {
	 "id": 1321,
	 "topic": "2; 2T: Time",
	 "topic_order": 147,
	 "concept_id": 195
 },
 {
	 "id": 1322,
	 "topic": "2; 2T: Time",
	 "topic_order": 148,
	 "concept_id": 196
 },
 {
	 "id": 1323,
	 "topic": "2; 2T: Time",
	 "topic_order": 149,
	 "concept_id": 197
 },
 {
	 "id": 1324,
	 "topic": "2; 2T: Time",
	 "topic_order": 150,
	 "concept_id": 198
 },
 {
	 "id": 1325,
	 "topic": "2; 2T: Time",
	 "topic_order": 151,
	 "concept_id": 199
 },
 {
	 "id": 1326,
	 "topic": "2; 2T: Time",
	 "topic_order": 152,
	 "concept_id": 200
 },
 {
	 "id": 1327,
	 "topic": "2; 2T: Time",
	 "topic_order": 153,
	 "concept_id": 201
 },
 {
	 "id": 1328,
	 "topic": "2; 2T: Time",
	 "topic_order": 154,
	 "concept_id": 202
 },
 {
	 "id": 1329,
	 "topic": "2; 3T: Transit",
	 "topic_order": 155,
	 "concept_id": 203
 },
 {
	 "id": 1330,
	 "topic": "2; 3T: Transit",
	 "topic_order": 156,
	 "concept_id": 204
 },
 {
	 "id": 1331,
	 "topic": "2; 3T: Transit",
	 "topic_order": 157,
	 "concept_id": 205
 },
 {
	 "id": 1332,
	 "topic": "2; 3T: Transit",
	 "topic_order": 158,
	 "concept_id": 206
 },
 {
	 "id": 1333,
	 "topic": "2; 3T: Transit",
	 "topic_order": 159,
	 "concept_id": 207
 },
 {
	 "id": 1334,
	 "topic": "2; 3T: Transit",
	 "topic_order": 160,
	 "concept_id": 208
 },
 {
	 "id": 1335,
	 "topic": "2; 3T: Transit",
	 "topic_order": 161,
	 "concept_id": 209
 },
 {
	 "id": 1336,
	 "topic": "2; 3T: Transit",
	 "topic_order": 162,
	 "concept_id": 210
 },
 {
	 "id": 1337,
	 "topic": "3; Activities",
	 "topic_order": 465,
	 "concept_id": 585
 },
 {
	 "id": 1338,
	 "topic": "3; Activities",
	 "topic_order": 466,
	 "concept_id": 586
 },
 {
	 "id": 1339,
	 "topic": "3; Activities",
	 "topic_order": 467,
	 "concept_id": 587
 },
 {
	 "id": 1340,
	 "topic": "3; Activities",
	 "topic_order": 468,
	 "concept_id": 588
 },
 {
	 "id": 1341,
	 "topic": "3; Activities",
	 "topic_order": 469,
	 "concept_id": 589
 },
 {
	 "id": 1342,
	 "topic": "3; Activities",
	 "topic_order": 470,
	 "concept_id": 590
 },
 {
	 "id": 1343,
	 "topic": "3; Activities",
	 "topic_order": 471,
	 "concept_id": 591
 },
 {
	 "id": 1344,
	 "topic": "3; Activities",
	 "topic_order": 472,
	 "concept_id": 592
 },
 {
	 "id": 1345,
	 "topic": "3; Activities",
	 "topic_order": 473,
	 "concept_id": 593
 },
 {
	 "id": 1346,
	 "topic": "3; Activities",
	 "topic_order": 474,
	 "concept_id": 594
 },
 {
	 "id": 1347,
	 "topic": "3; Activities",
	 "topic_order": 475,
	 "concept_id": 595
 },
 {
	 "id": 1348,
	 "topic": "3; Activities",
	 "topic_order": 476,
	 "concept_id": 596
 },
 {
	 "id": 1349,
	 "topic": "3; Activities",
	 "topic_order": 477,
	 "concept_id": 597
 },
 {
	 "id": 1350,
	 "topic": "3; Activities",
	 "topic_order": 478,
	 "concept_id": 598
 },
 {
	 "id": 1351,
	 "topic": "3; Activities",
	 "topic_order": 479,
	 "concept_id": 599
 },
 {
	 "id": 1352,
	 "topic": "3; Activities",
	 "topic_order": 480,
	 "concept_id": 600
 },
 {
	 "id": 1353,
	 "topic": "3; Activities",
	 "topic_order": 481,
	 "concept_id": 601
 },
 {
	 "id": 1354,
	 "topic": "3; Activities",
	 "topic_order": 482,
	 "concept_id": 602
 },
 {
	 "id": 1355,
	 "topic": "3; Activities",
	 "topic_order": 483,
	 "concept_id": 603
 },
 {
	 "id": 1356,
	 "topic": "3; Activities",
	 "topic_order": 484,
	 "concept_id": 604
 },
 {
	 "id": 1357,
	 "topic": "3; Activities",
	 "topic_order": 485,
	 "concept_id": 605
 },
 {
	 "id": 1358,
	 "topic": "3; Activities",
	 "topic_order": 486,
	 "concept_id": 606
 },
 {
	 "id": 1359,
	 "topic": "3; Activities",
	 "topic_order": 533,
	 "concept_id": 19
 },
 {
	 "id": 1360,
	 "topic": "3; Basics",
	 "topic_order": 487,
	 "concept_id": 607
 },
 {
	 "id": 1361,
	 "topic": "3; Basics",
	 "topic_order": 488,
	 "concept_id": 608
 },
 {
	 "id": 1362,
	 "topic": "3; Basics",
	 "topic_order": 489,
	 "concept_id": 609
 },
 {
	 "id": 1363,
	 "topic": "3; Basics",
	 "topic_order": 490,
	 "concept_id": 610
 },
 {
	 "id": 1364,
	 "topic": "3; Basics",
	 "topic_order": 491,
	 "concept_id": 611
 },
 {
	 "id": 1365,
	 "topic": "3; Basics",
	 "topic_order": 492,
	 "concept_id": 612
 },
 {
	 "id": 1366,
	 "topic": "3; Basics",
	 "topic_order": 493,
	 "concept_id": 613
 },
 {
	 "id": 1367,
	 "topic": "3; Basics",
	 "topic_order": 494,
	 "concept_id": 614
 },
 {
	 "id": 1368,
	 "topic": "3; Basics",
	 "topic_order": 495,
	 "concept_id": 615
 },
 {
	 "id": 1369,
	 "topic": "3; Basics",
	 "topic_order": 496,
	 "concept_id": 616
 },
 {
	 "id": 1370,
	 "topic": "3; Basics",
	 "topic_order": 497,
	 "concept_id": 617
 },
 {
	 "id": 1371,
	 "topic": "3; Basics",
	 "topic_order": 498,
	 "concept_id": 618
 },
 {
	 "id": 1372,
	 "topic": "3; Basics",
	 "topic_order": 499,
	 "concept_id": 619
 },
 {
	 "id": 1373,
	 "topic": "3; Basics",
	 "topic_order": 500,
	 "concept_id": 620
 },
 {
	 "id": 1374,
	 "topic": "3; Basics",
	 "topic_order": 501,
	 "concept_id": 621
 },
 {
	 "id": 1375,
	 "topic": "3; Basics",
	 "topic_order": 502,
	 "concept_id": 622
 },
 {
	 "id": 1376,
	 "topic": "3; Basics",
	 "topic_order": 503,
	 "concept_id": 623
 },
 {
	 "id": 1377,
	 "topic": "3; Basics",
	 "topic_order": 504,
	 "concept_id": 624
 },
 {
	 "id": 1378,
	 "topic": "3; Basics",
	 "topic_order": 505,
	 "concept_id": 625
 },
 {
	 "id": 1379,
	 "topic": "3; Basics",
	 "topic_order": 506,
	 "concept_id": 626
 },
 {
	 "id": 1380,
	 "topic": "3; Food",
	 "topic_order": 519,
	 "concept_id": 233
 },
 {
	 "id": 1381,
	 "topic": "3; Food",
	 "topic_order": 520,
	 "concept_id": 232
 },
 {
	 "id": 1382,
	 "topic": "3; Food",
	 "topic_order": 521,
	 "concept_id": 235
 },
 {
	 "id": 1383,
	 "topic": "3; Food",
	 "topic_order": 522,
	 "concept_id": 234
 },
 {
	 "id": 1384,
	 "topic": "3; Food",
	 "topic_order": 523,
	 "concept_id": 231
 },
 {
	 "id": 1385,
	 "topic": "3; Food",
	 "topic_order": 524,
	 "concept_id": 220
 },
 {
	 "id": 1386,
	 "topic": "3; Food",
	 "topic_order": 525,
	 "concept_id": 242
 },
 {
	 "id": 1387,
	 "topic": "3; Food",
	 "topic_order": 526,
	 "concept_id": 218
 },
 {
	 "id": 1388,
	 "topic": "3; Food",
	 "topic_order": 527,
	 "concept_id": 236
 },
 {
	 "id": 1389,
	 "topic": "3; Food",
	 "topic_order": 528,
	 "concept_id": 241
 },
 {
	 "id": 1390,
	 "topic": "3; Food",
	 "topic_order": 529,
	 "concept_id": 239
 },
 {
	 "id": 1391,
	 "topic": "3; Food",
	 "topic_order": 530,
	 "concept_id": 217
 },
 {
	 "id": 1392,
	 "topic": "3; Food",
	 "topic_order": 531,
	 "concept_id": 238
 },
 {
	 "id": 1393,
	 "topic": "3; Food",
	 "topic_order": 532,
	 "concept_id": 237
 },
 {
	 "id": 1394,
	 "topic": "3; Food",
	 "topic_order": 534,
	 "concept_id": 240
 },
 {
	 "id": 1395,
	 "topic": "3; Food",
	 "topic_order": 535,
	 "concept_id": 543
 },
 {
	 "id": 1396,
	 "topic": "3; Food",
	 "topic_order": 536,
	 "concept_id": 544
 },
 {
	 "id": 1397,
	 "topic": "3; Food",
	 "topic_order": 537,
	 "concept_id": 545
 },
 {
	 "id": 1398,
	 "topic": "3; Food",
	 "topic_order": 538,
	 "concept_id": 546
 },
 {
	 "id": 1399,
	 "topic": "3; Food",
	 "topic_order": 539,
	 "concept_id": 547
 },
 {
	 "id": 1400,
	 "topic": "3; Food",
	 "topic_order": 540,
	 "concept_id": 548
 },
 {
	 "id": 1401,
	 "topic": "3; Food",
	 "topic_order": 541,
	 "concept_id": 549
 },
 {
	 "id": 1402,
	 "topic": "3; Food",
	 "topic_order": 542,
	 "concept_id": 550
 },
 {
	 "id": 1403,
	 "topic": "3; Food",
	 "topic_order": 543,
	 "concept_id": 551
 },
 {
	 "id": 1404,
	 "topic": "3; Food",
	 "topic_order": 544,
	 "concept_id": 552
 },
 {
	 "id": 1405,
	 "topic": "3; Food",
	 "topic_order": 545,
	 "concept_id": 553
 },
 {
	 "id": 1406,
	 "topic": "3; Food",
	 "topic_order": 546,
	 "concept_id": 554
 },
 {
	 "id": 1407,
	 "topic": "3; Food",
	 "topic_order": 547,
	 "concept_id": 555
 },
 {
	 "id": 1408,
	 "topic": "3; Food",
	 "topic_order": 548,
	 "concept_id": 556
 },
 {
	 "id": 1409,
	 "topic": "3; Food",
	 "topic_order": 549,
	 "concept_id": 557
 },
 {
	 "id": 1410,
	 "topic": "3; Food",
	 "topic_order": 550,
	 "concept_id": 558
 },
 {
	 "id": 1411,
	 "topic": "3; Food",
	 "topic_order": 551,
	 "concept_id": 559
 },
 {
	 "id": 1412,
	 "topic": "3; Food",
	 "topic_order": 552,
	 "concept_id": 560
 },
 {
	 "id": 1413,
	 "topic": "3; Food",
	 "topic_order": 553,
	 "concept_id": 561
 },
 {
	 "id": 1414,
	 "topic": "3; Food",
	 "topic_order": 554,
	 "concept_id": 562
 },
 {
	 "id": 1415,
	 "topic": "3; Food",
	 "topic_order": 555,
	 "concept_id": 563
 },
 {
	 "id": 1416,
	 "topic": "3; Food",
	 "topic_order": 556,
	 "concept_id": 564
 },
 {
	 "id": 1417,
	 "topic": "3; Food",
	 "topic_order": 557,
	 "concept_id": 565
 },
 {
	 "id": 1418,
	 "topic": "3; Food",
	 "topic_order": 558,
	 "concept_id": 566
 },
 {
	 "id": 1419,
	 "topic": "3; Food",
	 "topic_order": 559,
	 "concept_id": 567
 },
 {
	 "id": 1420,
	 "topic": "3; Indoors",
	 "topic_order": 1000,
	 "concept_id": 227
 },
 {
	 "id": 1421,
	 "topic": "3; Indoors",
	 "topic_order": 1001,
	 "concept_id": 250
 },
 {
	 "id": 1422,
	 "topic": "3; Indoors",
	 "topic_order": 1002,
	 "concept_id": 134
 },
 {
	 "id": 1423,
	 "topic": "3; Indoors",
	 "topic_order": 1003,
	 "concept_id": 114
 },
 {
	 "id": 1424,
	 "topic": "3; Indoors",
	 "topic_order": 265,
	 "concept_id": 309
 },
 {
	 "id": 1425,
	 "topic": "3; Indoors",
	 "topic_order": 266,
	 "concept_id": 310
 },
 {
	 "id": 1426,
	 "topic": "3; Indoors",
	 "topic_order": 267,
	 "concept_id": 311
 },
 {
	 "id": 1427,
	 "topic": "3; Indoors",
	 "topic_order": 268,
	 "concept_id": 312
 },
 {
	 "id": 1428,
	 "topic": "3; Indoors",
	 "topic_order": 269,
	 "concept_id": 313
 },
 {
	 "id": 1429,
	 "topic": "3; Indoors",
	 "topic_order": 270,
	 "concept_id": 314
 },
 {
	 "id": 1430,
	 "topic": "3; Indoors",
	 "topic_order": 271,
	 "concept_id": 315
 },
 {
	 "id": 1431,
	 "topic": "3; Indoors",
	 "topic_order": 272,
	 "concept_id": 316
 },
 {
	 "id": 1432,
	 "topic": "3; Indoors",
	 "topic_order": 273,
	 "concept_id": 317
 },
 {
	 "id": 1433,
	 "topic": "3; Indoors",
	 "topic_order": 274,
	 "concept_id": 318
 },
 {
	 "id": 1434,
	 "topic": "3; Indoors",
	 "topic_order": 275,
	 "concept_id": 319
 },
 {
	 "id": 1435,
	 "topic": "3; Indoors",
	 "topic_order": 276,
	 "concept_id": 320
 },
 {
	 "id": 1436,
	 "topic": "3; Indoors",
	 "topic_order": 277,
	 "concept_id": 321
 },
 {
	 "id": 1437,
	 "topic": "3; Indoors",
	 "topic_order": 278,
	 "concept_id": 322
 },
 {
	 "id": 1438,
	 "topic": "3; Nature",
	 "topic_order": 396,
	 "concept_id": 459
 },
 {
	 "id": 1439,
	 "topic": "3; Nature",
	 "topic_order": 397,
	 "concept_id": 460
 },
 {
	 "id": 1440,
	 "topic": "3; Nature",
	 "topic_order": 398,
	 "concept_id": 461
 },
 {
	 "id": 1441,
	 "topic": "3; Nature",
	 "topic_order": 399,
	 "concept_id": 462
 },
 {
	 "id": 1442,
	 "topic": "3; Nature",
	 "topic_order": 400,
	 "concept_id": 463
 },
 {
	 "id": 1443,
	 "topic": "3; Nature",
	 "topic_order": 401,
	 "concept_id": 464
 },
 {
	 "id": 1444,
	 "topic": "3; Nature",
	 "topic_order": 402,
	 "concept_id": 465
 },
 {
	 "id": 1445,
	 "topic": "3; Nature",
	 "topic_order": 403,
	 "concept_id": 466
 },
 {
	 "id": 1446,
	 "topic": "3; Nature",
	 "topic_order": 404,
	 "concept_id": 467
 },
 {
	 "id": 1447,
	 "topic": "3; Nature",
	 "topic_order": 405,
	 "concept_id": 468
 },
 {
	 "id": 1448,
	 "topic": "3; Nature",
	 "topic_order": 406,
	 "concept_id": 469
 },
 {
	 "id": 1449,
	 "topic": "3; Nature",
	 "topic_order": 407,
	 "concept_id": 470
 },
 {
	 "id": 1450,
	 "topic": "3; Nature",
	 "topic_order": 408,
	 "concept_id": 471
 },
 {
	 "id": 1451,
	 "topic": "3; Nature",
	 "topic_order": 409,
	 "concept_id": 472
 },
 {
	 "id": 1452,
	 "topic": "3; Nature",
	 "topic_order": 507,
	 "concept_id": 229
 },
 {
	 "id": 1453,
	 "topic": "3; Nature",
	 "topic_order": 508,
	 "concept_id": 218
 },
 {
	 "id": 1454,
	 "topic": "3; Nature",
	 "topic_order": 509,
	 "concept_id": 233
 },
 {
	 "id": 1455,
	 "topic": "3; Nature",
	 "topic_order": 510,
	 "concept_id": 235
 },
 {
	 "id": 1456,
	 "topic": "3; Nature",
	 "topic_order": 511,
	 "concept_id": 146
 },
 {
	 "id": 1457,
	 "topic": "3; Nature",
	 "topic_order": 512,
	 "concept_id": 301
 },
 {
	 "id": 1458,
	 "topic": "3; Nature",
	 "topic_order": 513,
	 "concept_id": 147
 },
 {
	 "id": 1459,
	 "topic": "3; Nature",
	 "topic_order": 514,
	 "concept_id": 145
 },
 {
	 "id": 1460,
	 "topic": "3; Nature",
	 "topic_order": 515,
	 "concept_id": 303
 },
 {
	 "id": 1461,
	 "topic": "3; Nature",
	 "topic_order": 516,
	 "concept_id": 239
 },
 {
	 "id": 1462,
	 "topic": "3; Nature",
	 "topic_order": 517,
	 "concept_id": 240
 },
 {
	 "id": 1463,
	 "topic": "3; People",
	 "topic_order": 279,
	 "concept_id": 323
 },
 {
	 "id": 1464,
	 "topic": "3; People",
	 "topic_order": 280,
	 "concept_id": 324
 },
 {
	 "id": 1465,
	 "topic": "3; People",
	 "topic_order": 281,
	 "concept_id": 325
 },
 {
	 "id": 1466,
	 "topic": "3; People",
	 "topic_order": 282,
	 "concept_id": 326
 },
 {
	 "id": 1467,
	 "topic": "3; People",
	 "topic_order": 283,
	 "concept_id": 327
 },
 {
	 "id": 1468,
	 "topic": "3; People",
	 "topic_order": 284,
	 "concept_id": 328
 },
 {
	 "id": 1469,
	 "topic": "3; People",
	 "topic_order": 285,
	 "concept_id": 329
 },
 {
	 "id": 1470,
	 "topic": "3; People",
	 "topic_order": 286,
	 "concept_id": 330
 },
 {
	 "id": 1471,
	 "topic": "3; People",
	 "topic_order": 287,
	 "concept_id": 331
 },
 {
	 "id": 1472,
	 "topic": "3; People",
	 "topic_order": 288,
	 "concept_id": 332
 },
 {
	 "id": 1473,
	 "topic": "3; People",
	 "topic_order": 289,
	 "concept_id": 333
 },
 {
	 "id": 1474,
	 "topic": "3; People",
	 "topic_order": 290,
	 "concept_id": 334
 },
 {
	 "id": 1475,
	 "topic": "3; People",
	 "topic_order": 291,
	 "concept_id": 335
 },
 {
	 "id": 1476,
	 "topic": "3; People",
	 "topic_order": 292,
	 "concept_id": 336
 },
 {
	 "id": 1477,
	 "topic": "3; People",
	 "topic_order": 293,
	 "concept_id": 337
 },
 {
	 "id": 1478,
	 "topic": "3; People",
	 "topic_order": 294,
	 "concept_id": 338
 },
 {
	 "id": 1479,
	 "topic": "3; People",
	 "topic_order": 295,
	 "concept_id": 339
 },
 {
	 "id": 1480,
	 "topic": "3; People",
	 "topic_order": 296,
	 "concept_id": 340
 },
 {
	 "id": 1481,
	 "topic": "3; Sports and Health",
	 "topic_order": 352,
	 "concept_id": 419
 },
 {
	 "id": 1482,
	 "topic": "3; Sports and Health",
	 "topic_order": 353,
	 "concept_id": 420
 },
 {
	 "id": 1483,
	 "topic": "3; Sports and Health",
	 "topic_order": 354,
	 "concept_id": 421
 },
 {
	 "id": 1484,
	 "topic": "3; Sports and Health",
	 "topic_order": 355,
	 "concept_id": 422
 },
 {
	 "id": 1485,
	 "topic": "3; Sports and Health",
	 "topic_order": 356,
	 "concept_id": 423
 },
 {
	 "id": 1486,
	 "topic": "3; Sports and Health",
	 "topic_order": 357,
	 "concept_id": 424
 },
 {
	 "id": 1487,
	 "topic": "3; Sports and Health",
	 "topic_order": 358,
	 "concept_id": 425
 },
 {
	 "id": 1488,
	 "topic": "3; Sports and Health",
	 "topic_order": 359,
	 "concept_id": 426
 },
 {
	 "id": 1489,
	 "topic": "3; Sports and Health",
	 "topic_order": 360,
	 "concept_id": 427
 },
 {
	 "id": 1490,
	 "topic": "3; Sports and Health",
	 "topic_order": 361,
	 "concept_id": 428
 },
 {
	 "id": 1491,
	 "topic": "3; Sports and Health",
	 "topic_order": 362,
	 "concept_id": 429
 },
 {
	 "id": 1492,
	 "topic": "3; Sports and Health",
	 "topic_order": 363,
	 "concept_id": 430
 },
 {
	 "id": 1493,
	 "topic": "3; Sports and Health",
	 "topic_order": 364,
	 "concept_id": 431
 },
 {
	 "id": 1494,
	 "topic": "3; Sports and Health",
	 "topic_order": 365,
	 "concept_id": 432
 },
 {
	 "id": 1495,
	 "topic": "3; Sports and Health",
	 "topic_order": 366,
	 "concept_id": 433
 },
 {
	 "id": 1496,
	 "topic": "3; Sports and Health",
	 "topic_order": 367,
	 "concept_id": 434
 },
 {
	 "id": 1497,
	 "topic": "3; Sports and Health",
	 "topic_order": 368,
	 "concept_id": 435
 },
 {
	 "id": 1498,
	 "topic": "3; Sports and Health",
	 "topic_order": 369,
	 "concept_id": 436
 },
 {
	 "id": 1499,
	 "topic": "3; Sports and Health",
	 "topic_order": 370,
	 "concept_id": 437
 },
 {
	 "id": 1500,
	 "topic": "3; Sports and Health",
	 "topic_order": 371,
	 "concept_id": 438
 },
 {
	 "id": 1501,
	 "topic": "3; Sports and Health",
	 "topic_order": 372,
	 "concept_id": 439
 },
 {
	 "id": 1502,
	 "topic": "3; Sports and Health",
	 "topic_order": 373,
	 "concept_id": 440
 },
 {
	 "id": 1503,
	 "topic": "3; Sports and Health",
	 "topic_order": 374,
	 "concept_id": 441
 },
 {
	 "id": 1504,
	 "topic": "3; Sports and Health",
	 "topic_order": 375,
	 "concept_id": 442
 },
 {
	 "id": 1505,
	 "topic": "3; Sports and Health",
	 "topic_order": 376,
	 "concept_id": 443
 },
 {
	 "id": 1506,
	 "topic": "3; Sports and Health",
	 "topic_order": 377,
	 "concept_id": 444
 },
 {
	 "id": 1507,
	 "topic": "3; Sports and Health",
	 "topic_order": 378,
	 "concept_id": 445
 },
 {
	 "id": 1508,
	 "topic": "3; Sports and Health",
	 "topic_order": 379,
	 "concept_id": 446
 },
 {
	 "id": 1509,
	 "topic": "3; Sports and Health",
	 "topic_order": 380,
	 "concept_id": 447
 },
 {
	 "id": 1510,
	 "topic": "3; Sports and Health",
	 "topic_order": 381,
	 "concept_id": 448
 },
 {
	 "id": 1511,
	 "topic": "3; Sports and Health",
	 "topic_order": 382,
	 "concept_id": 449
 },
 {
	 "id": 1512,
	 "topic": "3; Sports and Health",
	 "topic_order": 383,
	 "concept_id": 450
 },
 {
	 "id": 1513,
	 "topic": "3; Sports and Health",
	 "topic_order": 384,
	 "concept_id": 451
 },
 {
	 "id": 1514,
	 "topic": "3; Sports and Health",
	 "topic_order": 385,
	 "concept_id": 452
 },
 {
	 "id": 1515,
	 "topic": "3; Sports and Health",
	 "topic_order": 386,
	 "concept_id": 453
 },
 {
	 "id": 1516,
	 "topic": "3; Sports and Health",
	 "topic_order": 387,
	 "concept_id": 454
 },
 {
	 "id": 1517,
	 "topic": "3; Sports and Health",
	 "topic_order": 388,
	 "concept_id": 455
 },
 {
	 "id": 1518,
	 "topic": "3; Sports and Health",
	 "topic_order": 389,
	 "concept_id": 69
 },
 {
	 "id": 1519,
	 "topic": "3; Sports and Health",
	 "topic_order": 390,
	 "concept_id": 290
 },
 {
	 "id": 1520,
	 "topic": "3; Sports and Health",
	 "topic_order": 391,
	 "concept_id": 299
 },
 {
	 "id": 1521,
	 "topic": "3; Sports and Health",
	 "topic_order": 392,
	 "concept_id": 15
 },
 {
	 "id": 1522,
	 "topic": "3; Sports and Health",
	 "topic_order": 393,
	 "concept_id": 150
 },
 {
	 "id": 1523,
	 "topic": "3; Sports and Health",
	 "topic_order": 394,
	 "concept_id": 174
 },
 {
	 "id": 1524,
	 "topic": "3; Sports and Health",
	 "topic_order": 395,
	 "concept_id": 21
 },
 {
	 "id": 1526,
	 "topic": "3; Town",
	 "topic_order": 298,
	 "concept_id": 356
 },
 {
	 "id": 1528,
	 "topic": "3; Town",
	 "topic_order": 300,
	 "concept_id": 358
 },
 {
	 "id": 1529,
	 "topic": "3; Town",
	 "topic_order": 301,
	 "concept_id": 359
 },
 {
	 "id": 1531,
	 "topic": "3; Town",
	 "topic_order": 303,
	 "concept_id": 361
 },
 {
	 "id": 1532,
	 "topic": "3; Town",
	 "topic_order": 304,
	 "concept_id": 362
 },
 {
	 "id": 1533,
	 "topic": "3; Town",
	 "topic_order": 305,
	 "concept_id": 363
 },
 {
	 "id": 1534,
	 "topic": "3; Town",
	 "topic_order": 306,
	 "concept_id": 364
 },
 {
	 "id": 1536,
	 "topic": "3; Town",
	 "topic_order": 308,
	 "concept_id": 366
 },
 {
	 "id": 1537,
	 "topic": "3; Town",
	 "topic_order": 309,
	 "concept_id": 367
 },
 {
	 "id": 1539,
	 "topic": "3; Town",
	 "topic_order": 311,
	 "concept_id": 369
 },
 {
	 "id": 1541,
	 "topic": "3; Town",
	 "topic_order": 313,
	 "concept_id": 371
 },
 {
	 "id": 1542,
	 "topic": "3; Town",
	 "topic_order": 314,
	 "concept_id": 372
 },
 {
	 "id": 1543,
	 "topic": "3; Town",
	 "topic_order": 315,
	 "concept_id": 373
 },
 {
	 "id": 1544,
	 "topic": "3; Town",
	 "topic_order": 316,
	 "concept_id": 374
 },
 {
	 "id": 1545,
	 "topic": "3; Town",
	 "topic_order": 317,
	 "concept_id": 375
 },
 {
	 "id": 1549,
	 "topic": "3; Town",
	 "topic_order": 321,
	 "concept_id": 355
 },
 {
	 "id": 1551,
	 "topic": "3; Town",
	 "topic_order": 323,
	 "concept_id": 357
 },
 {
	 "id": 1554,
	 "topic": "3; Town",
	 "topic_order": 326,
	 "concept_id": 360
 },
 {
	 "id": 1559,
	 "topic": "3; Town",
	 "topic_order": 331,
	 "concept_id": 365
 },
 {
	 "id": 1562,
	 "topic": "3; Town",
	 "topic_order": 334,
	 "concept_id": 368
 },
 {
	 "id": 1564,
	 "topic": "3; Town",
	 "topic_order": 336,
	 "concept_id": 370
 },
 {
	 "id": 1570,
	 "topic": "3; Town",
	 "topic_order": 342,
	 "concept_id": 376
 },
 {
	 "id": 1571,
	 "topic": "3; Town",
	 "topic_order": 343,
	 "concept_id": 377
 },
 {
	 "id": 1572,
	 "topic": "3; Town",
	 "topic_order": 344,
	 "concept_id": 378
 },
 {
	 "id": 1573,
	 "topic": "3; Town",
	 "topic_order": 345,
	 "concept_id": 151
 },
 {
	 "id": 1574,
	 "topic": "3; Town",
	 "topic_order": 346,
	 "concept_id": 152
 },
 {
	 "id": 1575,
	 "topic": "3; Town",
	 "topic_order": 347,
	 "concept_id": 148
 },
 {
	 "id": 1576,
	 "topic": "3; Town",
	 "topic_order": 348,
	 "concept_id": 63
 },
 {
	 "id": 1577,
	 "topic": "3; Town",
	 "topic_order": 349,
	 "concept_id": 156
 },
 {
	 "id": 1578,
	 "topic": "3; Town",
	 "topic_order": 350,
	 "concept_id": 112
 },
 {
	 "id": 1579,
	 "topic": "3; Town",
	 "topic_order": 351,
	 "concept_id": 109
 },
 {
	 "id": 1580,
	 "topic": "3; Travel",
	 "topic_order": 410,
	 "concept_id": 473
 },
 {
	 "id": 1581,
	 "topic": "3; Travel",
	 "topic_order": 411,
	 "concept_id": 474
 },
 {
	 "id": 1582,
	 "topic": "3; Travel",
	 "topic_order": 412,
	 "concept_id": 475
 },
 {
	 "id": 1583,
	 "topic": "3; Travel",
	 "topic_order": 413,
	 "concept_id": 476
 },
 {
	 "id": 1584,
	 "topic": "3; Travel",
	 "topic_order": 414,
	 "concept_id": 477
 },
 {
	 "id": 1585,
	 "topic": "3; Travel",
	 "topic_order": 415,
	 "concept_id": 478
 },
 {
	 "id": 1586,
	 "topic": "3; Travel",
	 "topic_order": 416,
	 "concept_id": 479
 },
 {
	 "id": 1587,
	 "topic": "3; Travel",
	 "topic_order": 417,
	 "concept_id": 480
 },
 {
	 "id": 1588,
	 "topic": "3; Travel",
	 "topic_order": 418,
	 "concept_id": 481
 },
 {
	 "id": 1589,
	 "topic": "3; Travel",
	 "topic_order": 419,
	 "concept_id": 482
 },
 {
	 "id": 1590,
	 "topic": "3; Travel",
	 "topic_order": 420,
	 "concept_id": 483
 },
 {
	 "id": 1591,
	 "topic": "3; Travel",
	 "topic_order": 421,
	 "concept_id": 484
 },
 {
	 "id": 1592,
	 "topic": "3; Travel",
	 "topic_order": 422,
	 "concept_id": 485
 },
 {
	 "id": 1593,
	 "topic": "3; Travel",
	 "topic_order": 423,
	 "concept_id": 486
 },
 {
	 "id": 1594,
	 "topic": "3; Travel",
	 "topic_order": 424,
	 "concept_id": 487
 },
 {
	 "id": 1595,
	 "topic": "3; Travel",
	 "topic_order": 425,
	 "concept_id": 488
 },
 {
	 "id": 1596,
	 "topic": "3; Travel",
	 "topic_order": 426,
	 "concept_id": 489
 },
 {
	 "id": 1597,
	 "topic": "3; Travel",
	 "topic_order": 427,
	 "concept_id": 490
 },
 {
	 "id": 1598,
	 "topic": "3; Travel",
	 "topic_order": 428,
	 "concept_id": 491
 },
 {
	 "id": 1599,
	 "topic": "3; Travel",
	 "topic_order": 429,
	 "concept_id": 492
 },
 {
	 "id": 1600,
	 "topic": "3; Travel",
	 "topic_order": 430,
	 "concept_id": 493
 },
 {
	 "id": 1601,
	 "topic": "3; Travel",
	 "topic_order": 431,
	 "concept_id": 494
 },
 {
	 "id": 1602,
	 "topic": "3; Travel",
	 "topic_order": 432,
	 "concept_id": 495
 },
 {
	 "id": 1603,
	 "topic": "3; Travel",
	 "topic_order": 433,
	 "concept_id": 496
 },
 {
	 "id": 1604,
	 "topic": "3; Travel",
	 "topic_order": 434,
	 "concept_id": 497
 },
 {
	 "id": 1605,
	 "topic": "3; Travel",
	 "topic_order": 435,
	 "concept_id": 498
 },
 {
	 "id": 1606,
	 "topic": "3; Travel",
	 "topic_order": 436,
	 "concept_id": 499
 },
 {
	 "id": 1607,
	 "topic": "3; Travel",
	 "topic_order": 437,
	 "concept_id": 500
 },
 {
	 "id": 1608,
	 "topic": "3; Travel",
	 "topic_order": 438,
	 "concept_id": 501
 },
 {
	 "id": 1609,
	 "topic": "3; Travel",
	 "topic_order": 439,
	 "concept_id": 502
 },
 {
	 "id": 1610,
	 "topic": "3; Travel",
	 "topic_order": 440,
	 "concept_id": 543
 },
 {
	 "id": 1611,
	 "topic": "3; Travel",
	 "topic_order": 441,
	 "concept_id": 544
 },
 {
	 "id": 1612,
	 "topic": "3; Travel",
	 "topic_order": 442,
	 "concept_id": 545
 },
 {
	 "id": 1613,
	 "topic": "3; Travel",
	 "topic_order": 443,
	 "concept_id": 546
 },
 {
	 "id": 1614,
	 "topic": "3; Travel",
	 "topic_order": 444,
	 "concept_id": 547
 },
 {
	 "id": 1615,
	 "topic": "3; Travel",
	 "topic_order": 445,
	 "concept_id": 548
 },
 {
	 "id": 1616,
	 "topic": "3; Travel",
	 "topic_order": 446,
	 "concept_id": 549
 },
 {
	 "id": 1617,
	 "topic": "3; Travel",
	 "topic_order": 447,
	 "concept_id": 550
 },
 {
	 "id": 1618,
	 "topic": "3; Travel",
	 "topic_order": 448,
	 "concept_id": 551
 },
 {
	 "id": 1619,
	 "topic": "3; Travel",
	 "topic_order": 449,
	 "concept_id": 552
 },
 {
	 "id": 1620,
	 "topic": "3; Travel",
	 "topic_order": 450,
	 "concept_id": 553
 },
 {
	 "id": 1621,
	 "topic": "3; Travel",
	 "topic_order": 451,
	 "concept_id": 554
 },
 {
	 "id": 1622,
	 "topic": "3; Travel",
	 "topic_order": 452,
	 "concept_id": 555
 },
 {
	 "id": 1623,
	 "topic": "3; Travel",
	 "topic_order": 453,
	 "concept_id": 556
 },
 {
	 "id": 1624,
	 "topic": "3; Travel",
	 "topic_order": 454,
	 "concept_id": 557
 },
 {
	 "id": 1625,
	 "topic": "3; Travel",
	 "topic_order": 455,
	 "concept_id": 558
 },
 {
	 "id": 1626,
	 "topic": "3; Travel",
	 "topic_order": 456,
	 "concept_id": 559
 },
 {
	 "id": 1627,
	 "topic": "3; Travel",
	 "topic_order": 457,
	 "concept_id": 560
 },
 {
	 "id": 1628,
	 "topic": "3; Travel",
	 "topic_order": 458,
	 "concept_id": 561
 },
 {
	 "id": 1629,
	 "topic": "3; Travel",
	 "topic_order": 459,
	 "concept_id": 562
 },
 {
	 "id": 1630,
	 "topic": "3; Travel",
	 "topic_order": 460,
	 "concept_id": 563
 },
 {
	 "id": 1631,
	 "topic": "3; Travel",
	 "topic_order": 461,
	 "concept_id": 564
 },
 {
	 "id": 1632,
	 "topic": "3; Travel",
	 "topic_order": 462,
	 "concept_id": 565
 },
 {
	 "id": 1633,
	 "topic": "3; Travel",
	 "topic_order": 463,
	 "concept_id": 566
 },
 {
	 "id": 1634,
	 "topic": "3; Travel",
	 "topic_order": 464,
	 "concept_id": 567
 },
 {
	 "id": 1635,
	 "topic": "3; Travel",
	 "topic_order": 518,
	 "concept_id": 142
 },
 {
	 "id": 1636,
	 "topic": "4; Actions",
	 "topic_order": 671,
	 "concept_id": 738
 },
 {
	 "id": 1637,
	 "topic": "4; Actions",
	 "topic_order": 672,
	 "concept_id": 739
 },
 {
	 "id": 1638,
	 "topic": "4; Actions",
	 "topic_order": 673,
	 "concept_id": 740
 },
 {
	 "id": 1639,
	 "topic": "4; Actions",
	 "topic_order": 674,
	 "concept_id": 741
 },
 {
	 "id": 1640,
	 "topic": "4; Actions",
	 "topic_order": 675,
	 "concept_id": 742
 },
 {
	 "id": 1641,
	 "topic": "4; Actions",
	 "topic_order": 676,
	 "concept_id": 743
 },
 {
	 "id": 1642,
	 "topic": "4; Actions",
	 "topic_order": 677,
	 "concept_id": 744
 },
 {
	 "id": 1643,
	 "topic": "4; Actions",
	 "topic_order": 678,
	 "concept_id": 745
 },
 {
	 "id": 1644,
	 "topic": "4; Actions",
	 "topic_order": 679,
	 "concept_id": 746
 },
 {
	 "id": 1645,
	 "topic": "4; Actions",
	 "topic_order": 680,
	 "concept_id": 747
 },
 {
	 "id": 1646,
	 "topic": "4; Actions",
	 "topic_order": 681,
	 "concept_id": 748
 },
 {
	 "id": 1647,
	 "topic": "4; Actions",
	 "topic_order": 682,
	 "concept_id": 749
 },
 {
	 "id": 1648,
	 "topic": "4; Actions",
	 "topic_order": 683,
	 "concept_id": 750
 },
 {
	 "id": 1649,
	 "topic": "4; Actions",
	 "topic_order": 684,
	 "concept_id": 751
 },
 {
	 "id": 1650,
	 "topic": "4; Actions",
	 "topic_order": 685,
	 "concept_id": 752
 },
 {
	 "id": 1651,
	 "topic": "4; Actions",
	 "topic_order": 686,
	 "concept_id": 753
 },
 {
	 "id": 1652,
	 "topic": "4; Actions",
	 "topic_order": 687,
	 "concept_id": 754
 },
 {
	 "id": 1653,
	 "topic": "4; Actions",
	 "topic_order": 688,
	 "concept_id": 755
 },
 {
	 "id": 1654,
	 "topic": "4; Actions",
	 "topic_order": 689,
	 "concept_id": 756
 },
 {
	 "id": 1655,
	 "topic": "4; Actions",
	 "topic_order": 690,
	 "concept_id": 757
 },
 {
	 "id": 1656,
	 "topic": "4; Actions",
	 "topic_order": 691,
	 "concept_id": 758
 },
 {
	 "id": 1657,
	 "topic": "4; Actions",
	 "topic_order": 692,
	 "concept_id": 759
 },
 {
	 "id": 1658,
	 "topic": "4; Actions",
	 "topic_order": 693,
	 "concept_id": 760
 },
 {
	 "id": 1659,
	 "topic": "4; Actions",
	 "topic_order": 694,
	 "concept_id": 761
 },
 {
	 "id": 1660,
	 "topic": "4; Actions",
	 "topic_order": 695,
	 "concept_id": 762
 },
 {
	 "id": 1661,
	 "topic": "4; Actions",
	 "topic_order": 696,
	 "concept_id": 763
 },
 {
	 "id": 1662,
	 "topic": "4; Actions",
	 "topic_order": 697,
	 "concept_id": 764
 },
 {
	 "id": 1663,
	 "topic": "4; Actions",
	 "topic_order": 698,
	 "concept_id": 765
 },
 {
	 "id": 1664,
	 "topic": "4; Actions",
	 "topic_order": 699,
	 "concept_id": 766
 },
 {
	 "id": 1665,
	 "topic": "4; Actions",
	 "topic_order": 700,
	 "concept_id": 767
 },
 {
	 "id": 1666,
	 "topic": "4; Actions",
	 "topic_order": 701,
	 "concept_id": 768
 },
 {
	 "id": 1667,
	 "topic": "4; Actions",
	 "topic_order": 702,
	 "concept_id": 769
 },
 {
	 "id": 1668,
	 "topic": "4; Actions",
	 "topic_order": 703,
	 "concept_id": 770
 },
 {
	 "id": 1669,
	 "topic": "4; Actions",
	 "topic_order": 704,
	 "concept_id": 771
 },
 {
	 "id": 1670,
	 "topic": "4; Actions",
	 "topic_order": 705,
	 "concept_id": 772
 },
 {
	 "id": 1671,
	 "topic": "4; Actions",
	 "topic_order": 706,
	 "concept_id": 773
 },
 {
	 "id": 1672,
	 "topic": "4; Actions",
	 "topic_order": 707,
	 "concept_id": 774
 },
 {
	 "id": 1673,
	 "topic": "4; Actions",
	 "topic_order": 708,
	 "concept_id": 775
 },
 {
	 "id": 1674,
	 "topic": "4; Actions",
	 "topic_order": 709,
	 "concept_id": 776
 },
 {
	 "id": 1675,
	 "topic": "4; Actions",
	 "topic_order": 710,
	 "concept_id": 777
 },
 {
	 "id": 1676,
	 "topic": "4; Activities",
	 "topic_order": 576,
	 "concept_id": 643
 },
 {
	 "id": 1677,
	 "topic": "4; Activities",
	 "topic_order": 577,
	 "concept_id": 644
 },
 {
	 "id": 1678,
	 "topic": "4; Activities",
	 "topic_order": 578,
	 "concept_id": 645
 },
 {
	 "id": 1679,
	 "topic": "4; Activities",
	 "topic_order": 579,
	 "concept_id": 646
 },
 {
	 "id": 1680,
	 "topic": "4; Activities",
	 "topic_order": 580,
	 "concept_id": 647
 },
 {
	 "id": 1681,
	 "topic": "4; Basics",
	 "topic_order": 581,
	 "concept_id": 648
 },
 {
	 "id": 1682,
	 "topic": "4; Basics",
	 "topic_order": 582,
	 "concept_id": 649
 },
 {
	 "id": 1683,
	 "topic": "4; Basics",
	 "topic_order": 583,
	 "concept_id": 650
 },
 {
	 "id": 1684,
	 "topic": "4; Basics",
	 "topic_order": 584,
	 "concept_id": 651
 },
 {
	 "id": 1685,
	 "topic": "4; Basics",
	 "topic_order": 585,
	 "concept_id": 652
 },
 {
	 "id": 1686,
	 "topic": "4; Basics",
	 "topic_order": 586,
	 "concept_id": 653
 },
 {
	 "id": 1687,
	 "topic": "4; Basics",
	 "topic_order": 587,
	 "concept_id": 654
 },
 {
	 "id": 1688,
	 "topic": "4; Basics",
	 "topic_order": 588,
	 "concept_id": 655
 },
 {
	 "id": 1689,
	 "topic": "4; Basics",
	 "topic_order": 589,
	 "concept_id": 656
 },
 {
	 "id": 1690,
	 "topic": "4; Basics",
	 "topic_order": 590,
	 "concept_id": 657
 },
 {
	 "id": 1691,
	 "topic": "4; Basics",
	 "topic_order": 591,
	 "concept_id": 658
 },
 {
	 "id": 1692,
	 "topic": "4; Basics",
	 "topic_order": 592,
	 "concept_id": 659
 },
 {
	 "id": 1693,
	 "topic": "4; Basics",
	 "topic_order": 593,
	 "concept_id": 660
 },
 {
	 "id": 1694,
	 "topic": "4; Basics",
	 "topic_order": 594,
	 "concept_id": 661
 },
 {
	 "id": 1695,
	 "topic": "4; Basics",
	 "topic_order": 595,
	 "concept_id": 662
 },
 {
	 "id": 1696,
	 "topic": "4; Basics",
	 "topic_order": 596,
	 "concept_id": 663
 },
 {
	 "id": 1697,
	 "topic": "4; Basics",
	 "topic_order": 597,
	 "concept_id": 664
 },
 {
	 "id": 1698,
	 "topic": "4; Basics",
	 "topic_order": 598,
	 "concept_id": 665
 },
 {
	 "id": 1699,
	 "topic": "4; Basics",
	 "topic_order": 599,
	 "concept_id": 666
 },
 {
	 "id": 1700,
	 "topic": "4; Basics",
	 "topic_order": 600,
	 "concept_id": 667
 },
 {
	 "id": 1701,
	 "topic": "4; Basics",
	 "topic_order": 601,
	 "concept_id": 668
 },
 {
	 "id": 1702,
	 "topic": "4; Basics",
	 "topic_order": 602,
	 "concept_id": 669
 },
 {
	 "id": 1703,
	 "topic": "4; Basics",
	 "topic_order": 603,
	 "concept_id": 670
 },
 {
	 "id": 1704,
	 "topic": "4; Basics",
	 "topic_order": 604,
	 "concept_id": 671
 },
 {
	 "id": 1705,
	 "topic": "4; Basics",
	 "topic_order": 605,
	 "concept_id": 672
 },
 {
	 "id": 1706,
	 "topic": "4; Basics",
	 "topic_order": 606,
	 "concept_id": 673
 },
 {
	 "id": 1707,
	 "topic": "4; Basics",
	 "topic_order": 607,
	 "concept_id": 674
 },
 {
	 "id": 1708,
	 "topic": "4; Basics",
	 "topic_order": 608,
	 "concept_id": 675
 },
 {
	 "id": 1709,
	 "topic": "4; Basics",
	 "topic_order": 609,
	 "concept_id": 676
 },
 {
	 "id": 1710,
	 "topic": "4; Basics",
	 "topic_order": 610,
	 "concept_id": 677
 },
 {
	 "id": 1711,
	 "topic": "4; Basics",
	 "topic_order": 611,
	 "concept_id": 678
 },
 {
	 "id": 1712,
	 "topic": "4; Basics",
	 "topic_order": 612,
	 "concept_id": 679
 },
 {
	 "id": 1713,
	 "topic": "4; Basics",
	 "topic_order": 613,
	 "concept_id": 680
 },
 {
	 "id": 1714,
	 "topic": "4; Basics",
	 "topic_order": 614,
	 "concept_id": 681
 },
 {
	 "id": 1715,
	 "topic": "4; Basics",
	 "topic_order": 615,
	 "concept_id": 682
 },
 {
	 "id": 1716,
	 "topic": "4; Basics",
	 "topic_order": 616,
	 "concept_id": 683
 },
 {
	 "id": 1717,
	 "topic": "4; Basics",
	 "topic_order": 617,
	 "concept_id": 684
 },
 {
	 "id": 1718,
	 "topic": "4; Basics",
	 "topic_order": 618,
	 "concept_id": 685
 },
 {
	 "id": 1719,
	 "topic": "4; Basics",
	 "topic_order": 619,
	 "concept_id": 686
 },
 {
	 "id": 1720,
	 "topic": "4; Basics",
	 "topic_order": 620,
	 "concept_id": 687
 },
 {
	 "id": 1721,
	 "topic": "4; Basics",
	 "topic_order": 621,
	 "concept_id": 688
 },
 {
	 "id": 1722,
	 "topic": "4; Basics",
	 "topic_order": 622,
	 "concept_id": 689
 },
 {
	 "id": 1723,
	 "topic": "4; Basics",
	 "topic_order": 623,
	 "concept_id": 690
 },
 {
	 "id": 1724,
	 "topic": "4; Basics",
	 "topic_order": 624,
	 "concept_id": 691
 },
 {
	 "id": 1725,
	 "topic": "4; Basics",
	 "topic_order": 625,
	 "concept_id": 692
 },
 {
	 "id": 1726,
	 "topic": "4; Basics",
	 "topic_order": 626,
	 "concept_id": 693
 },
 {
	 "id": 1727,
	 "topic": "4; Basics",
	 "topic_order": 627,
	 "concept_id": 694
 },
 {
	 "id": 1728,
	 "topic": "4; Basics",
	 "topic_order": 628,
	 "concept_id": 695
 },
 {
	 "id": 1729,
	 "topic": "4; Basics",
	 "topic_order": 629,
	 "concept_id": 696
 },
 {
	 "id": 1730,
	 "topic": "4; Indoors",
	 "topic_order": 560,
	 "concept_id": 627
 },
 {
	 "id": 1731,
	 "topic": "4; Indoors",
	 "topic_order": 561,
	 "concept_id": 628
 },
 {
	 "id": 1732,
	 "topic": "4; Indoors",
	 "topic_order": 562,
	 "concept_id": 629
 },
 {
	 "id": 1733,
	 "topic": "4; Indoors",
	 "topic_order": 563,
	 "concept_id": 630
 },
 {
	 "id": 1734,
	 "topic": "4; Indoors",
	 "topic_order": 564,
	 "concept_id": 631
 },
 {
	 "id": 1735,
	 "topic": "4; Indoors",
	 "topic_order": 565,
	 "concept_id": 632
 },
 {
	 "id": 1736,
	 "topic": "4; Indoors",
	 "topic_order": 566,
	 "concept_id": 633
 },
 {
	 "id": 1737,
	 "topic": "4; Indoors",
	 "topic_order": 567,
	 "concept_id": 634
 },
 {
	 "id": 1738,
	 "topic": "4; Indoors",
	 "topic_order": 568,
	 "concept_id": 635
 },
 {
	 "id": 1739,
	 "topic": "4; Indoors",
	 "topic_order": 569,
	 "concept_id": 636
 },
 {
	 "id": 1740,
	 "topic": "4; Indoors",
	 "topic_order": 570,
	 "concept_id": 637
 },
 {
	 "id": 1741,
	 "topic": "4; Indoors",
	 "topic_order": 571,
	 "concept_id": 638
 },
 {
	 "id": 1742,
	 "topic": "4; Indoors",
	 "topic_order": 572,
	 "concept_id": 639
 },
 {
	 "id": 1743,
	 "topic": "4; Indoors",
	 "topic_order": 573,
	 "concept_id": 640
 },
 {
	 "id": 1744,
	 "topic": "4; Indoors",
	 "topic_order": 574,
	 "concept_id": 641
 },
 {
	 "id": 1745,
	 "topic": "4; Indoors",
	 "topic_order": 575,
	 "concept_id": 642
 },
 {
	 "id": 1746,
	 "topic": "4; Places",
	 "topic_order": 649,
	 "concept_id": 716
 },
 {
	 "id": 1747,
	 "topic": "4; Places",
	 "topic_order": 650,
	 "concept_id": 717
 },
 {
	 "id": 1748,
	 "topic": "4; Places",
	 "topic_order": 651,
	 "concept_id": 718
 },
 {
	 "id": 1749,
	 "topic": "4; Places",
	 "topic_order": 652,
	 "concept_id": 719
 },
 {
	 "id": 1750,
	 "topic": "4; Places",
	 "topic_order": 653,
	 "concept_id": 720
 },
 {
	 "id": 1751,
	 "topic": "4; Places",
	 "topic_order": 654,
	 "concept_id": 721
 },
 {
	 "id": 1752,
	 "topic": "4; Places",
	 "topic_order": 655,
	 "concept_id": 722
 },
 {
	 "id": 1753,
	 "topic": "4; Places",
	 "topic_order": 656,
	 "concept_id": 723
 },
 {
	 "id": 1754,
	 "topic": "4; Places",
	 "topic_order": 657,
	 "concept_id": 724
 },
 {
	 "id": 1755,
	 "topic": "4; Places",
	 "topic_order": 658,
	 "concept_id": 725
 },
 {
	 "id": 1756,
	 "topic": "4; Places",
	 "topic_order": 659,
	 "concept_id": 726
 },
 {
	 "id": 1757,
	 "topic": "4; Places",
	 "topic_order": 660,
	 "concept_id": 727
 },
 {
	 "id": 1758,
	 "topic": "4; Places",
	 "topic_order": 661,
	 "concept_id": 728
 },
 {
	 "id": 1759,
	 "topic": "4; Places",
	 "topic_order": 662,
	 "concept_id": 729
 },
 {
	 "id": 1760,
	 "topic": "4; Places",
	 "topic_order": 663,
	 "concept_id": 730
 },
 {
	 "id": 1761,
	 "topic": "4; Places",
	 "topic_order": 664,
	 "concept_id": 731
 },
 {
	 "id": 1762,
	 "topic": "4; Places",
	 "topic_order": 665,
	 "concept_id": 732
 },
 {
	 "id": 1763,
	 "topic": "4; Places",
	 "topic_order": 666,
	 "concept_id": 733
 },
 {
	 "id": 1764,
	 "topic": "4; Places",
	 "topic_order": 667,
	 "concept_id": 734
 },
 {
	 "id": 1765,
	 "topic": "4; Places",
	 "topic_order": 668,
	 "concept_id": 735
 },
 {
	 "id": 1766,
	 "topic": "4; Places",
	 "topic_order": 669,
	 "concept_id": 736
 },
 {
	 "id": 1767,
	 "topic": "4; Places",
	 "topic_order": 670,
	 "concept_id": 737
 },
 {
	 "id": 1768,
	 "topic": "4; Time",
	 "topic_order": 630,
	 "concept_id": 697
 },
 {
	 "id": 1769,
	 "topic": "4; Time",
	 "topic_order": 631,
	 "concept_id": 698
 },
 {
	 "id": 1770,
	 "topic": "4; Time",
	 "topic_order": 632,
	 "concept_id": 699
 },
 {
	 "id": 1771,
	 "topic": "4; Time",
	 "topic_order": 633,
	 "concept_id": 700
 },
 {
	 "id": 1772,
	 "topic": "4; Time",
	 "topic_order": 634,
	 "concept_id": 701
 },
 {
	 "id": 1773,
	 "topic": "4; Time",
	 "topic_order": 635,
	 "concept_id": 702
 },
 {
	 "id": 1774,
	 "topic": "4; Time",
	 "topic_order": 636,
	 "concept_id": 703
 },
 {
	 "id": 1775,
	 "topic": "4; Time",
	 "topic_order": 637,
	 "concept_id": 704
 },
 {
	 "id": 1776,
	 "topic": "4; Time",
	 "topic_order": 638,
	 "concept_id": 705
 },
 {
	 "id": 1777,
	 "topic": "4; Time",
	 "topic_order": 639,
	 "concept_id": 706
 },
 {
	 "id": 1778,
	 "topic": "4; Time",
	 "topic_order": 640,
	 "concept_id": 707
 },
 {
	 "id": 1779,
	 "topic": "4; Time",
	 "topic_order": 641,
	 "concept_id": 708
 },
 {
	 "id": 1780,
	 "topic": "4; Time",
	 "topic_order": 642,
	 "concept_id": 709
 },
 {
	 "id": 1781,
	 "topic": "4; Time",
	 "topic_order": 643,
	 "concept_id": 710
 },
 {
	 "id": 1782,
	 "topic": "4; Time",
	 "topic_order": 644,
	 "concept_id": 711
 },
 {
	 "id": 1783,
	 "topic": "4; Time",
	 "topic_order": 645,
	 "concept_id": 712
 },
 {
	 "id": 1784,
	 "topic": "4; Time",
	 "topic_order": 646,
	 "concept_id": 713
 },
 {
	 "id": 1785,
	 "topic": "4; Time",
	 "topic_order": 647,
	 "concept_id": 714
 },
 {
	 "id": 1786,
	 "topic": "4; Time",
	 "topic_order": 648,
	 "concept_id": 715
 },
 {
	 "id": 1787,
	 "topic": "5; Abstract Objects",
	 "topic_order": 835,
	 "concept_id": 887
 },
 {
	 "id": 1788,
	 "topic": "5; Abstract Objects",
	 "topic_order": 836,
	 "concept_id": 888
 },
 {
	 "id": 1789,
	 "topic": "5; Abstract Objects",
	 "topic_order": 837,
	 "concept_id": 889
 },
 {
	 "id": 1790,
	 "topic": "5; Abstract Objects",
	 "topic_order": 838,
	 "concept_id": 890
 },
 {
	 "id": 1791,
	 "topic": "5; Abstract Objects",
	 "topic_order": 839,
	 "concept_id": 891
 },
 {
	 "id": 1792,
	 "topic": "5; Abstract Objects",
	 "topic_order": 840,
	 "concept_id": 892
 },
 {
	 "id": 1793,
	 "topic": "5; Abstract Objects",
	 "topic_order": 841,
	 "concept_id": 893
 },
 {
	 "id": 1794,
	 "topic": "5; Abstract Objects",
	 "topic_order": 842,
	 "concept_id": 894
 },
 {
	 "id": 1795,
	 "topic": "5; Abstract Objects",
	 "topic_order": 843,
	 "concept_id": 895
 },
 {
	 "id": 1796,
	 "topic": "5; Abstract Objects",
	 "topic_order": 844,
	 "concept_id": 896
 },
 {
	 "id": 1797,
	 "topic": "5; Abstract Objects",
	 "topic_order": 845,
	 "concept_id": 897
 },
 {
	 "id": 1798,
	 "topic": "5; Abstract Objects",
	 "topic_order": 846,
	 "concept_id": 898
 },
 {
	 "id": 1799,
	 "topic": "5; Abstract Objects",
	 "topic_order": 847,
	 "concept_id": 899
 },
 {
	 "id": 1800,
	 "topic": "5; Abstract Objects",
	 "topic_order": 848,
	 "concept_id": 900
 },
 {
	 "id": 1801,
	 "topic": "5; Abstract Objects",
	 "topic_order": 849,
	 "concept_id": 901
 },
 {
	 "id": 1802,
	 "topic": "5; Abstract Objects",
	 "topic_order": 850,
	 "concept_id": 902
 },
 {
	 "id": 1803,
	 "topic": "5; Abstract Objects",
	 "topic_order": 851,
	 "concept_id": 903
 },
 {
	 "id": 1804,
	 "topic": "5; Abstract Objects",
	 "topic_order": 852,
	 "concept_id": 904
 },
 {
	 "id": 1805,
	 "topic": "5; Abstract Objects",
	 "topic_order": 853,
	 "concept_id": 905
 },
 {
	 "id": 1806,
	 "topic": "5; Abstract Objects",
	 "topic_order": 854,
	 "concept_id": 906
 },
 {
	 "id": 1807,
	 "topic": "5; Abstract Objects",
	 "topic_order": 855,
	 "concept_id": 907
 },
 {
	 "id": 1808,
	 "topic": "5; Abstract Objects",
	 "topic_order": 856,
	 "concept_id": 908
 },
 {
	 "id": 1809,
	 "topic": "5; Abstract Objects",
	 "topic_order": 857,
	 "concept_id": 909
 },
 {
	 "id": 1810,
	 "topic": "5; Abstract Objects",
	 "topic_order": 858,
	 "concept_id": 910
 },
 {
	 "id": 1811,
	 "topic": "5; Abstract Objects",
	 "topic_order": 859,
	 "concept_id": 911
 },
 {
	 "id": 1812,
	 "topic": "5; Abstract Objects",
	 "topic_order": 860,
	 "concept_id": 912
 },
 {
	 "id": 1813,
	 "topic": "5; Abstract Objects",
	 "topic_order": 861,
	 "concept_id": 913
 },
 {
	 "id": 1814,
	 "topic": "5; Abstract Objects",
	 "topic_order": 862,
	 "concept_id": 914
 },
 {
	 "id": 1815,
	 "topic": "5; Abstract Objects",
	 "topic_order": 863,
	 "concept_id": 915
 },
 {
	 "id": 1816,
	 "topic": "5; Abstract Objects",
	 "topic_order": 864,
	 "concept_id": 916
 },
 {
	 "id": 1817,
	 "topic": "5; Abstract Objects",
	 "topic_order": 865,
	 "concept_id": 917
 },
 {
	 "id": 1818,
	 "topic": "5; Abstract Objects",
	 "topic_order": 866,
	 "concept_id": 918
 },
 {
	 "id": 1819,
	 "topic": "5; Abstract Objects",
	 "topic_order": 867,
	 "concept_id": 919
 },
 {
	 "id": 1820,
	 "topic": "5; Abstract Objects",
	 "topic_order": 868,
	 "concept_id": 920
 },
 {
	 "id": 1821,
	 "topic": "5; Abstract Objects",
	 "topic_order": 869,
	 "concept_id": 921
 },
 {
	 "id": 1822,
	 "topic": "5; Abstract Objects",
	 "topic_order": 870,
	 "concept_id": 922
 },
 {
	 "id": 1823,
	 "topic": "5; Abstract Objects",
	 "topic_order": 871,
	 "concept_id": 923
 },
 {
	 "id": 1824,
	 "topic": "5; Abstract Objects",
	 "topic_order": 872,
	 "concept_id": 924
 },
 {
	 "id": 1825,
	 "topic": "5; Abstract Objects",
	 "topic_order": 873,
	 "concept_id": 925
 },
 {
	 "id": 1826,
	 "topic": "5; Abstract Objects",
	 "topic_order": 874,
	 "concept_id": 926
 },
 {
	 "id": 1827,
	 "topic": "5; Abstract Objects",
	 "topic_order": 875,
	 "concept_id": 927
 },
 {
	 "id": 1828,
	 "topic": "5; Abstract Objects",
	 "topic_order": 876,
	 "concept_id": 928
 },
 {
	 "id": 1829,
	 "topic": "5; Abstract Objects",
	 "topic_order": 877,
	 "concept_id": 929
 },
 {
	 "id": 1830,
	 "topic": "5; Abstract Objects",
	 "topic_order": 878,
	 "concept_id": 930
 },
 {
	 "id": 1831,
	 "topic": "5; Abstract Objects",
	 "topic_order": 879,
	 "concept_id": 931
 },
 {
	 "id": 1832,
	 "topic": "5; Abstract Objects",
	 "topic_order": 880,
	 "concept_id": 932
 },
 {
	 "id": 1833,
	 "topic": "5; Abstract Objects",
	 "topic_order": 881,
	 "concept_id": 933
 },
 {
	 "id": 1834,
	 "topic": "5; Actions",
	 "topic_order": 967,
	 "concept_id": 1123
 },
 {
	 "id": 1835,
	 "topic": "5; Actions",
	 "topic_order": 968,
	 "concept_id": 1124
 },
 {
	 "id": 1836,
	 "topic": "5; Actions",
	 "topic_order": 969,
	 "concept_id": 1125
 },
 {
	 "id": 1837,
	 "topic": "5; Actions",
	 "topic_order": 970,
	 "concept_id": 1126
 },
 {
	 "id": 1838,
	 "topic": "5; Actions",
	 "topic_order": 971,
	 "concept_id": 1127
 },
 {
	 "id": 1839,
	 "topic": "5; Actions",
	 "topic_order": 972,
	 "concept_id": 1128
 },
 {
	 "id": 1840,
	 "topic": "5; Actions",
	 "topic_order": 973,
	 "concept_id": 1129
 },
 {
	 "id": 1841,
	 "topic": "5; Actions",
	 "topic_order": 974,
	 "concept_id": 1130
 },
 {
	 "id": 1842,
	 "topic": "5; Actions",
	 "topic_order": 975,
	 "concept_id": 1131
 },
 {
	 "id": 1843,
	 "topic": "5; Actions",
	 "topic_order": 976,
	 "concept_id": 1132
 },
 {
	 "id": 1844,
	 "topic": "5; Actions",
	 "topic_order": 977,
	 "concept_id": 1133
 },
 {
	 "id": 1845,
	 "topic": "5; Actions",
	 "topic_order": 978,
	 "concept_id": 1134
 },
 {
	 "id": 1846,
	 "topic": "5; Actions",
	 "topic_order": 979,
	 "concept_id": 1135
 },
 {
	 "id": 1847,
	 "topic": "5; Actions",
	 "topic_order": 980,
	 "concept_id": 1136
 },
 {
	 "id": 1848,
	 "topic": "5; Actions",
	 "topic_order": 981,
	 "concept_id": 1137
 },
 {
	 "id": 1849,
	 "topic": "5; Actions",
	 "topic_order": 982,
	 "concept_id": 1138
 },
 {
	 "id": 1850,
	 "topic": "5; Actions",
	 "topic_order": 983,
	 "concept_id": 1139
 },
 {
	 "id": 1851,
	 "topic": "5; Actions",
	 "topic_order": 984,
	 "concept_id": 1140
 },
 {
	 "id": 1852,
	 "topic": "5; Actions",
	 "topic_order": 985,
	 "concept_id": 1141
 },
 {
	 "id": 1853,
	 "topic": "5; Actions",
	 "topic_order": 986,
	 "concept_id": 1142
 },
 {
	 "id": 1854,
	 "topic": "5; Actions",
	 "topic_order": 987,
	 "concept_id": 1143
 },
 {
	 "id": 1855,
	 "topic": "5; Actions",
	 "topic_order": 988,
	 "concept_id": 1144
 },
 {
	 "id": 1856,
	 "topic": "5; Actions",
	 "topic_order": 989,
	 "concept_id": 1145
 },
 {
	 "id": 1857,
	 "topic": "5; Actions",
	 "topic_order": 990,
	 "concept_id": 1146
 },
 {
	 "id": 1858,
	 "topic": "5; Actions",
	 "topic_order": 991,
	 "concept_id": 1147
 },
 {
	 "id": 1859,
	 "topic": "5; Actions",
	 "topic_order": 992,
	 "concept_id": 1148
 },
 {
	 "id": 1860,
	 "topic": "5; Actions",
	 "topic_order": 993,
	 "concept_id": 1149
 },
 {
	 "id": 1861,
	 "topic": "5; Actions",
	 "topic_order": 994,
	 "concept_id": 1150
 },
 {
	 "id": 1862,
	 "topic": "5; Actions",
	 "topic_order": 995,
	 "concept_id": 1151
 },
 {
	 "id": 1863,
	 "topic": "5; Actions",
	 "topic_order": 996,
	 "concept_id": 1152
 },
 {
	 "id": 1864,
	 "topic": "5; Actions",
	 "topic_order": 997,
	 "concept_id": 1153
 },
 {
	 "id": 1865,
	 "topic": "5; Basics",
	 "topic_order": 753,
	 "concept_id": 820
 },
 {
	 "id": 1866,
	 "topic": "5; Basics",
	 "topic_order": 754,
	 "concept_id": 821
 },
 {
	 "id": 1867,
	 "topic": "5; Basics",
	 "topic_order": 755,
	 "concept_id": 822
 },
 {
	 "id": 1868,
	 "topic": "5; Basics",
	 "topic_order": 756,
	 "concept_id": 823
 },
 {
	 "id": 1869,
	 "topic": "5; Basics",
	 "topic_order": 757,
	 "concept_id": 824
 },
 {
	 "id": 1870,
	 "topic": "5; Basics",
	 "topic_order": 758,
	 "concept_id": 825
 },
 {
	 "id": 1871,
	 "topic": "5; Basics",
	 "topic_order": 759,
	 "concept_id": 826
 },
 {
	 "id": 1872,
	 "topic": "5; Basics",
	 "topic_order": 760,
	 "concept_id": 827
 },
 {
	 "id": 1873,
	 "topic": "5; Basics",
	 "topic_order": 761,
	 "concept_id": 828
 },
 {
	 "id": 1874,
	 "topic": "5; Basics",
	 "topic_order": 762,
	 "concept_id": 829
 },
 {
	 "id": 1875,
	 "topic": "5; Basics",
	 "topic_order": 763,
	 "concept_id": 830
 },
 {
	 "id": 1876,
	 "topic": "5; Basics",
	 "topic_order": 764,
	 "concept_id": 831
 },
 {
	 "id": 1877,
	 "topic": "5; Basics",
	 "topic_order": 765,
	 "concept_id": 832
 },
 {
	 "id": 1878,
	 "topic": "5; Basics",
	 "topic_order": 766,
	 "concept_id": 833
 },
 {
	 "id": 1879,
	 "topic": "5; Calendar",
	 "topic_order": 711,
	 "concept_id": 778
 },
 {
	 "id": 1880,
	 "topic": "5; Calendar",
	 "topic_order": 712,
	 "concept_id": 779
 },
 {
	 "id": 1881,
	 "topic": "5; Calendar",
	 "topic_order": 713,
	 "concept_id": 780
 },
 {
	 "id": 1882,
	 "topic": "5; Calendar",
	 "topic_order": 714,
	 "concept_id": 781
 },
 {
	 "id": 1883,
	 "topic": "5; Calendar",
	 "topic_order": 715,
	 "concept_id": 782
 },
 {
	 "id": 1884,
	 "topic": "5; Calendar",
	 "topic_order": 716,
	 "concept_id": 783
 },
 {
	 "id": 1885,
	 "topic": "5; Calendar",
	 "topic_order": 717,
	 "concept_id": 784
 },
 {
	 "id": 1886,
	 "topic": "5; Calendar",
	 "topic_order": 718,
	 "concept_id": 785
 },
 {
	 "id": 1887,
	 "topic": "5; Calendar",
	 "topic_order": 719,
	 "concept_id": 786
 },
 {
	 "id": 1888,
	 "topic": "5; Calendar",
	 "topic_order": 720,
	 "concept_id": 787
 },
 {
	 "id": 1889,
	 "topic": "5; Calendar",
	 "topic_order": 721,
	 "concept_id": 788
 },
 {
	 "id": 1890,
	 "topic": "5; Calendar",
	 "topic_order": 722,
	 "concept_id": 789
 },
 {
	 "id": 1891,
	 "topic": "5; Calendar",
	 "topic_order": 723,
	 "concept_id": 790
 },
 {
	 "id": 1892,
	 "topic": "5; Calendar",
	 "topic_order": 724,
	 "concept_id": 791
 },
 {
	 "id": 1893,
	 "topic": "5; Calendar",
	 "topic_order": 725,
	 "concept_id": 792
 },
 {
	 "id": 1894,
	 "topic": "5; Calendar",
	 "topic_order": 726,
	 "concept_id": 793
 },
 {
	 "id": 1895,
	 "topic": "5; Calendar",
	 "topic_order": 727,
	 "concept_id": 794
 },
 {
	 "id": 1896,
	 "topic": "5; Calendar",
	 "topic_order": 728,
	 "concept_id": 795
 },
 {
	 "id": 1897,
	 "topic": "5; Calendar",
	 "topic_order": 729,
	 "concept_id": 796
 },
 {
	 "id": 1898,
	 "topic": "5; Calendar",
	 "topic_order": 730,
	 "concept_id": 797
 },
 {
	 "id": 1899,
	 "topic": "5; Calendar",
	 "topic_order": 731,
	 "concept_id": 798
 },
 {
	 "id": 1900,
	 "topic": "5; Calendar",
	 "topic_order": 732,
	 "concept_id": 799
 },
 {
	 "id": 1901,
	 "topic": "5; Calendar",
	 "topic_order": 733,
	 "concept_id": 800
 },
 {
	 "id": 1902,
	 "topic": "5; Calendar",
	 "topic_order": 734,
	 "concept_id": 801
 },
 {
	 "id": 1903,
	 "topic": "5; Calendar",
	 "topic_order": 735,
	 "concept_id": 802
 },
 {
	 "id": 1904,
	 "topic": "5; Calendar",
	 "topic_order": 736,
	 "concept_id": 803
 },
 {
	 "id": 1905,
	 "topic": "5; Calendar",
	 "topic_order": 737,
	 "concept_id": 804
 },
 {
	 "id": 1906,
	 "topic": "5; Calendar",
	 "topic_order": 738,
	 "concept_id": 805
 },
 {
	 "id": 1907,
	 "topic": "5; Calendar",
	 "topic_order": 739,
	 "concept_id": 806
 },
 {
	 "id": 1908,
	 "topic": "5; Calendar",
	 "topic_order": 740,
	 "concept_id": 807
 },
 {
	 "id": 1909,
	 "topic": "5; Calendar",
	 "topic_order": 741,
	 "concept_id": 808
 },
 {
	 "id": 1910,
	 "topic": "5; Calendar",
	 "topic_order": 742,
	 "concept_id": 809
 },
 {
	 "id": 1911,
	 "topic": "5; Calendar",
	 "topic_order": 743,
	 "concept_id": 810
 },
 {
	 "id": 1912,
	 "topic": "5; Counting",
	 "topic_order": 899,
	 "concept_id": 951
 },
 {
	 "id": 1913,
	 "topic": "5; Counting",
	 "topic_order": 900,
	 "concept_id": 952
 },
 {
	 "id": 1914,
	 "topic": "5; Counting",
	 "topic_order": 901,
	 "concept_id": 953
 },
 {
	 "id": 1915,
	 "topic": "5; Counting",
	 "topic_order": 902,
	 "concept_id": 954
 },
 {
	 "id": 1916,
	 "topic": "5; Counting",
	 "topic_order": 903,
	 "concept_id": 955
 },
 {
	 "id": 1917,
	 "topic": "5; Counting",
	 "topic_order": 904,
	 "concept_id": 956
 },
 {
	 "id": 1918,
	 "topic": "5; Counting",
	 "topic_order": 905,
	 "concept_id": 957
 },
 {
	 "id": 1919,
	 "topic": "5; Counting",
	 "topic_order": 906,
	 "concept_id": 958
 },
 {
	 "id": 1920,
	 "topic": "5; Counting",
	 "topic_order": 907,
	 "concept_id": 959
 },
 {
	 "id": 1921,
	 "topic": "5; Counting",
	 "topic_order": 908,
	 "concept_id": 960
 },
 {
	 "id": 1922,
	 "topic": "5; Counting",
	 "topic_order": 909,
	 "concept_id": 961
 },
 {
	 "id": 1923,
	 "topic": "5; Counting",
	 "topic_order": 910,
	 "concept_id": 962
 },
 {
	 "id": 1924,
	 "topic": "5; Counting",
	 "topic_order": 911,
	 "concept_id": 963
 },
 {
	 "id": 1925,
	 "topic": "5; Counting",
	 "topic_order": 912,
	 "concept_id": 964
 },
 {
	 "id": 1926,
	 "topic": "5; Counting",
	 "topic_order": 913,
	 "concept_id": 965
 },
 {
	 "id": 1927,
	 "topic": "5; Counting",
	 "topic_order": 914,
	 "concept_id": 966
 },
 {
	 "id": 1928,
	 "topic": "5; Counting",
	 "topic_order": 915,
	 "concept_id": 967
 },
 {
	 "id": 1929,
	 "topic": "5; Counting",
	 "topic_order": 916,
	 "concept_id": 968
 },
 {
	 "id": 1930,
	 "topic": "5; Counting",
	 "topic_order": 917,
	 "concept_id": 969
 },
 {
	 "id": 1931,
	 "topic": "5; Counting",
	 "topic_order": 918,
	 "concept_id": 970
 },
 {
	 "id": 1932,
	 "topic": "5; Counting",
	 "topic_order": 919,
	 "concept_id": 971
 },
 {
	 "id": 1933,
	 "topic": "5; Counting",
	 "topic_order": 920,
	 "concept_id": 972
 },
 {
	 "id": 1934,
	 "topic": "5; Counting",
	 "topic_order": 921,
	 "concept_id": 973
 },
 {
	 "id": 1935,
	 "topic": "5; Counting",
	 "topic_order": 922,
	 "concept_id": 974
 },
 {
	 "id": 1936,
	 "topic": "5; Counting",
	 "topic_order": 923,
	 "concept_id": 975
 },
 {
	 "id": 1937,
	 "topic": "5; Counting",
	 "topic_order": 924,
	 "concept_id": 976
 },
 {
	 "id": 1938,
	 "topic": "5; Counting",
	 "topic_order": 925,
	 "concept_id": 977
 },
 {
	 "id": 1939,
	 "topic": "5; Counting",
	 "topic_order": 926,
	 "concept_id": 978
 },
 {
	 "id": 1940,
	 "topic": "5; Counting",
	 "topic_order": 927,
	 "concept_id": 979
 },
 {
	 "id": 1941,
	 "topic": "5; Counting",
	 "topic_order": 928,
	 "concept_id": 980
 },
 {
	 "id": 1942,
	 "topic": "5; Counting",
	 "topic_order": 929,
	 "concept_id": 981
 },
 {
	 "id": 1943,
	 "topic": "5; Counting",
	 "topic_order": 930,
	 "concept_id": 982
 },
 {
	 "id": 1944,
	 "topic": "5; Counting",
	 "topic_order": 931,
	 "concept_id": 983
 },
 {
	 "id": 1945,
	 "topic": "5; Counting",
	 "topic_order": 932,
	 "concept_id": 984
 },
 {
	 "id": 1946,
	 "topic": "5; Counting",
	 "topic_order": 933,
	 "concept_id": 985
 },
 {
	 "id": 1947,
	 "topic": "5; Counting",
	 "topic_order": 934,
	 "concept_id": 986
 },
 {
	 "id": 1948,
	 "topic": "5; Descriptions",
	 "topic_order": 882,
	 "concept_id": 934
 },
 {
	 "id": 1949,
	 "topic": "5; Descriptions",
	 "topic_order": 883,
	 "concept_id": 935
 },
 {
	 "id": 1950,
	 "topic": "5; Descriptions",
	 "topic_order": 884,
	 "concept_id": 936
 },
 {
	 "id": 1951,
	 "topic": "5; Descriptions",
	 "topic_order": 885,
	 "concept_id": 937
 },
 {
	 "id": 1952,
	 "topic": "5; Descriptions",
	 "topic_order": 886,
	 "concept_id": 938
 },
 {
	 "id": 1953,
	 "topic": "5; Descriptions",
	 "topic_order": 887,
	 "concept_id": 939
 },
 {
	 "id": 1954,
	 "topic": "5; Descriptions",
	 "topic_order": 888,
	 "concept_id": 940
 },
 {
	 "id": 1955,
	 "topic": "5; Descriptions",
	 "topic_order": 889,
	 "concept_id": 941
 },
 {
	 "id": 1956,
	 "topic": "5; Descriptions",
	 "topic_order": 890,
	 "concept_id": 942
 },
 {
	 "id": 1957,
	 "topic": "5; Descriptions",
	 "topic_order": 891,
	 "concept_id": 943
 },
 {
	 "id": 1958,
	 "topic": "5; Descriptions",
	 "topic_order": 892,
	 "concept_id": 944
 },
 {
	 "id": 1959,
	 "topic": "5; Descriptions",
	 "topic_order": 893,
	 "concept_id": 945
 },
 {
	 "id": 1960,
	 "topic": "5; Descriptions",
	 "topic_order": 894,
	 "concept_id": 946
 },
 {
	 "id": 1961,
	 "topic": "5; Descriptions",
	 "topic_order": 895,
	 "concept_id": 947
 },
 {
	 "id": 1962,
	 "topic": "5; Descriptions",
	 "topic_order": 896,
	 "concept_id": 948
 },
 {
	 "id": 1963,
	 "topic": "5; Descriptions",
	 "topic_order": 897,
	 "concept_id": 949
 },
 {
	 "id": 1964,
	 "topic": "5; Descriptions",
	 "topic_order": 898,
	 "concept_id": 950
 },
 {
	 "id": 1965,
	 "topic": "5; Direction",
	 "topic_order": 744,
	 "concept_id": 811
 },
 {
	 "id": 1966,
	 "topic": "5; Direction",
	 "topic_order": 745,
	 "concept_id": 812
 },
 {
	 "id": 1967,
	 "topic": "5; Direction",
	 "topic_order": 746,
	 "concept_id": 813
 },
 {
	 "id": 1968,
	 "topic": "5; Direction",
	 "topic_order": 747,
	 "concept_id": 814
 },
 {
	 "id": 1969,
	 "topic": "5; Direction",
	 "topic_order": 748,
	 "concept_id": 815
 },
 {
	 "id": 1970,
	 "topic": "5; Direction",
	 "topic_order": 749,
	 "concept_id": 816
 },
 {
	 "id": 1971,
	 "topic": "5; Direction",
	 "topic_order": 750,
	 "concept_id": 817
 },
 {
	 "id": 1972,
	 "topic": "5; Direction",
	 "topic_order": 751,
	 "concept_id": 818
 },
 {
	 "id": 1973,
	 "topic": "5; Direction",
	 "topic_order": 752,
	 "concept_id": 819
 },
 {
	 "id": 1974,
	 "topic": "5; Feelings",
	 "topic_order": 818,
	 "concept_id": 862
 },
 {
	 "id": 1975,
	 "topic": "5; Feelings",
	 "topic_order": 819,
	 "concept_id": 863
 },
 {
	 "id": 1976,
	 "topic": "5; Feelings",
	 "topic_order": 820,
	 "concept_id": 864
 },
 {
	 "id": 1977,
	 "topic": "5; Feelings",
	 "topic_order": 821,
	 "concept_id": 865
 },
 {
	 "id": 1978,
	 "topic": "5; Feelings",
	 "topic_order": 822,
	 "concept_id": 866
 },
 {
	 "id": 1979,
	 "topic": "5; Feelings",
	 "topic_order": 823,
	 "concept_id": 867
 },
 {
	 "id": 1980,
	 "topic": "5; Feelings",
	 "topic_order": 824,
	 "concept_id": 868
 },
 {
	 "id": 1981,
	 "topic": "5; Feelings",
	 "topic_order": 825,
	 "concept_id": 869
 },
 {
	 "id": 1982,
	 "topic": "5; Feelings",
	 "topic_order": 826,
	 "concept_id": 870
 },
 {
	 "id": 1983,
	 "topic": "5; Feelings",
	 "topic_order": 827,
	 "concept_id": 871
 },
 {
	 "id": 1984,
	 "topic": "5; Feelings",
	 "topic_order": 828,
	 "concept_id": 872
 },
 {
	 "id": 1985,
	 "topic": "5; Feelings",
	 "topic_order": 829,
	 "concept_id": 873
 },
 {
	 "id": 1986,
	 "topic": "5; Feelings",
	 "topic_order": 830,
	 "concept_id": 874
 },
 {
	 "id": 1987,
	 "topic": "5; Feelings",
	 "topic_order": 831,
	 "concept_id": 875
 },
 {
	 "id": 1988,
	 "topic": "5; Feelings",
	 "topic_order": 832,
	 "concept_id": 876
 },
 {
	 "id": 1989,
	 "topic": "5; Feelings",
	 "topic_order": 833,
	 "concept_id": 877
 },
 {
	 "id": 1990,
	 "topic": "5; Feelings",
	 "topic_order": 834,
	 "concept_id": 878
 },
 {
	 "id": 1991,
	 "topic": "5; Food",
	 "topic_order": 787,
	 "concept_id": 848
 },
 {
	 "id": 1992,
	 "topic": "5; Food",
	 "topic_order": 788,
	 "concept_id": 849
 },
 {
	 "id": 1993,
	 "topic": "5; Food",
	 "topic_order": 789,
	 "concept_id": 850
 },
 {
	 "id": 1994,
	 "topic": "5; Food",
	 "topic_order": 790,
	 "concept_id": 851
 },
 {
	 "id": 1995,
	 "topic": "5; Food",
	 "topic_order": 791,
	 "concept_id": 852
 },
 {
	 "id": 1996,
	 "topic": "5; Food",
	 "topic_order": 792,
	 "concept_id": 853
 },
 {
	 "id": 1997,
	 "topic": "5; Food",
	 "topic_order": 793,
	 "concept_id": 854
 },
 {
	 "id": 1998,
	 "topic": "5; Food",
	 "topic_order": 794,
	 "concept_id": 855
 },
 {
	 "id": 1999,
	 "topic": "5; Food",
	 "topic_order": 795,
	 "concept_id": 856
 },
 {
	 "id": 2000,
	 "topic": "5; Food",
	 "topic_order": 796,
	 "concept_id": 857
 },
 {
	 "id": 2001,
	 "topic": "5; Food",
	 "topic_order": 797,
	 "concept_id": 858
 },
 {
	 "id": 2002,
	 "topic": "5; Food",
	 "topic_order": 798,
	 "concept_id": 859
 },
 {
	 "id": 2003,
	 "topic": "5; Food",
	 "topic_order": 799,
	 "concept_id": 860
 },
 {
	 "id": 2004,
	 "topic": "5; Food",
	 "topic_order": 800,
	 "concept_id": 861
 },
 {
	 "id": 2005,
	 "topic": "5; Food",
	 "topic_order": 801,
	 "concept_id": 862
 },
 {
	 "id": 2006,
	 "topic": "5; Food",
	 "topic_order": 802,
	 "concept_id": 863
 },
 {
	 "id": 2007,
	 "topic": "5; Food",
	 "topic_order": 803,
	 "concept_id": 864
 },
 {
	 "id": 2008,
	 "topic": "5; Food",
	 "topic_order": 804,
	 "concept_id": 865
 },
 {
	 "id": 2009,
	 "topic": "5; Food",
	 "topic_order": 805,
	 "concept_id": 866
 },
 {
	 "id": 2010,
	 "topic": "5; Food",
	 "topic_order": 806,
	 "concept_id": 867
 },
 {
	 "id": 2011,
	 "topic": "5; Food",
	 "topic_order": 807,
	 "concept_id": 868
 },
 {
	 "id": 2012,
	 "topic": "5; Food",
	 "topic_order": 808,
	 "concept_id": 869
 },
 {
	 "id": 2013,
	 "topic": "5; Food",
	 "topic_order": 809,
	 "concept_id": 870
 },
 {
	 "id": 2014,
	 "topic": "5; Food",
	 "topic_order": 810,
	 "concept_id": 871
 },
 {
	 "id": 2015,
	 "topic": "5; Food",
	 "topic_order": 811,
	 "concept_id": 872
 },
 {
	 "id": 2016,
	 "topic": "5; Food",
	 "topic_order": 812,
	 "concept_id": 873
 },
 {
	 "id": 2017,
	 "topic": "5; Food",
	 "topic_order": 813,
	 "concept_id": 874
 },
 {
	 "id": 2018,
	 "topic": "5; Food",
	 "topic_order": 814,
	 "concept_id": 875
 },
 {
	 "id": 2019,
	 "topic": "5; Food",
	 "topic_order": 815,
	 "concept_id": 876
 },
 {
	 "id": 2020,
	 "topic": "5; Food",
	 "topic_order": 816,
	 "concept_id": 877
 },
 {
	 "id": 2021,
	 "topic": "5; Food",
	 "topic_order": 817,
	 "concept_id": 878
 },
 {
	 "id": 2022,
	 "topic": "5; Indoors",
	 "topic_order": 782,
	 "concept_id": 843
 },
 {
	 "id": 2023,
	 "topic": "5; Indoors",
	 "topic_order": 783,
	 "concept_id": 844
 },
 {
	 "id": 2024,
	 "topic": "5; Indoors",
	 "topic_order": 784,
	 "concept_id": 845
 },
 {
	 "id": 2025,
	 "topic": "5; Indoors",
	 "topic_order": 785,
	 "concept_id": 846
 },
 {
	 "id": 2026,
	 "topic": "5; Indoors",
	 "topic_order": 786,
	 "concept_id": 847
 },
 {
	 "id": 2027,
	 "topic": "5; Nature",
	 "topic_order": 773,
	 "concept_id": 834
 },
 {
	 "id": 2028,
	 "topic": "5; Nature",
	 "topic_order": 774,
	 "concept_id": 835
 },
 {
	 "id": 2029,
	 "topic": "5; Nature",
	 "topic_order": 775,
	 "concept_id": 836
 },
 {
	 "id": 2030,
	 "topic": "5; Nature",
	 "topic_order": 776,
	 "concept_id": 837
 },
 {
	 "id": 2031,
	 "topic": "5; Nature",
	 "topic_order": 777,
	 "concept_id": 838
 },
 {
	 "id": 2032,
	 "topic": "5; Nature",
	 "topic_order": 778,
	 "concept_id": 839
 },
 {
	 "id": 2033,
	 "topic": "5; Nature",
	 "topic_order": 779,
	 "concept_id": 840
 },
 {
	 "id": 2034,
	 "topic": "5; Nature",
	 "topic_order": 780,
	 "concept_id": 841
 },
 {
	 "id": 2035,
	 "topic": "5; Nature",
	 "topic_order": 781,
	 "concept_id": 842
 },
 {
	 "id": 2036,
	 "topic": "5; People",
	 "topic_order": 935,
	 "concept_id": 1091
 },
 {
	 "id": 2037,
	 "topic": "5; People",
	 "topic_order": 936,
	 "concept_id": 1092
 },
 {
	 "id": 2038,
	 "topic": "5; People",
	 "topic_order": 937,
	 "concept_id": 1093
 },
 {
	 "id": 2039,
	 "topic": "5; People",
	 "topic_order": 938,
	 "concept_id": 1094
 },
 {
	 "id": 2040,
	 "topic": "5; People",
	 "topic_order": 939,
	 "concept_id": 1095
 },
 {
	 "id": 2041,
	 "topic": "5; People",
	 "topic_order": 940,
	 "concept_id": 1096
 },
 {
	 "id": 2042,
	 "topic": "5; People",
	 "topic_order": 941,
	 "concept_id": 1097
 },
 {
	 "id": 2043,
	 "topic": "5; People",
	 "topic_order": 942,
	 "concept_id": 1098
 },
 {
	 "id": 2044,
	 "topic": "5; People",
	 "topic_order": 943,
	 "concept_id": 1099
 },
 {
	 "id": 2045,
	 "topic": "5; People",
	 "topic_order": 944,
	 "concept_id": 1100
 },
 {
	 "id": 2046,
	 "topic": "5; People",
	 "topic_order": 945,
	 "concept_id": 1101
 },
 {
	 "id": 2047,
	 "topic": "5; People",
	 "topic_order": 946,
	 "concept_id": 1102
 }
]

export const topics_valid_concepts: TopicValidConceptsDatum[] = (() => {
	// H: Equivalent of old-sb."CEFR_TOPICS_VALID_CONCEPTS"
	// - i.e. "VALID" here means 'THERE EXISTS PHRASES.'
	
	// Create a Set of VALID concept IDs for quick lookup 
	const validConceptIds = new Set(
		cefrConcepts
			.filter(c => c.phrases.length > 0)
			.map(c => c.id)
	);

	// Group topic entries by topic, filtering out invalid concept_ids
	const groupedByTopic = cefrTopicEntries.reduce((acc, entry) => {
		// Only include entries where the concept_id exists in cefrConcepts
		if (validConceptIds.has(entry.concept_id)) {
			const conceptIds = acc[entry.topic] ?? (acc[entry.topic] = []);
			conceptIds.push(entry.concept_id);
		}
		return acc;
	}, {} as Record<string, number[]>);

	// Convert to array format and sort by topic
	return Object.entries(groupedByTopic)
		.map(([topic, valid_concept_ids]) => ({
			topic,
			valid_concept_ids,
			valid_size: valid_concept_ids.length
		}))
		.sort((a, b) => a.topic.localeCompare(b.topic));
})(); // fyi: trailing '()' = Immediately Invoked Function Expression (IIFE). It means this is only calculated once (not each time this const is used).

// CEFR_VIEW (aka fetchConceptsByTopic, aka potential_concepts)
export const cefrViewConceptsWithTopic: CEFRViewConceptWithTopic[] = // only runs once.
	cefrTopicEntries.flatMap(topicEntry => {
		const concept = cefrConcepts.find(c => c.id === topicEntry.concept_id);
		if (!concept) {
			console.warn(`Concept with id ${topicEntry.concept_id} not found for topic entry ${topicEntry.id}`); // <- shouldn't occur
			return [];
		}
		return [{
			topic_id: topicEntry.id,
			topic: topicEntry.topic,
			topic_order: topicEntry.topic_order,
			concept_id: topicEntry.concept_id,
			label: concept.label,
			phrases: concept.phrases
		}];
	});

export function fetchCEFRConceptsByTopic(topic: string): CEFRViewConceptWithTopic[] {
	return cefrViewConceptsWithTopic
		.filter(cv=>cv.topic==topic)
		.sort((a, b) => a.topic_order - b.topic_order);
}

export const cefrConceptUppercaseLABELS: string[] = cefrConcepts.map(c=>c.label.toUpperCase());

export function fetchValidConceptsTotal(): number {
	const validConcepts = cefrConcepts.filter(concept => 
		concept.phrases.length > 0
	);
	return validConcepts.length;
}

export function getRandomPhraseInConcept(concept: CEFRViewConceptWithTopic|CEFRConcept):string|null {
	if (!concept) return null;
	let phrases:string[] = concept.phrases;
	if (phrases.length == 0) {
		console.log("⚠️ Shouldn't happen. Concept has no phrases to get.", concept);
		return null;
	}
	return phrases[Math.floor(Math.random() * phrases.length)] ?? null;
}

export const processableTexts: string[] = Array.from(
	new Set(
		cefrConcepts.flatMap(concept => 
			[concept.label, ...concept.phrases].filter(Boolean)
		)
	)
);

export function a1800ViewInitializeQuestionChoices({
	topic_concepts, concepts_covered_2, cur_concept
}: {
	topic_concepts: (CEFRViewConceptWithTopic|CEFRConcept)[] | null;
	concepts_covered_2: number[] | null;
	cur_concept: CEFRViewConceptWithTopic | CEFRConcept | null;
}):string[] {
	if (!topic_concepts || !concepts_covered_2 || !cur_concept) return [];

	// Gather Past Covered Phrases (this should just be a constant that gets updated, from parent, since its also used elsewhere)
	let other_covered_concepts:(CEFRViewConceptWithTopic|CEFRConcept)[] = [];
	for (var i=0; i<topic_concepts.length; i++) {
		const concept = topic_concepts[i];
		if (!concept) continue;
		if (concept.label == cur_concept.label) continue;
		let conceptID:number = (concept as CEFRViewConceptWithTopic).concept_id ?? (concept as CEFRConcept).id;
		if (concepts_covered_2.includes(conceptID)) {
			other_covered_concepts.push(concept);
		}
	}

	let choices:string[] = [];
	let max_attempts = 16;
	let cur_attempt = 0;

	while (cur_attempt<max_attempts) {
		let random_concept = other_covered_concepts[Math.floor(Math.random() * other_covered_concepts.length)];
		if (!random_concept) break;
		// 20231022. Ah! Because I've altered content; e.g. "I" no longer has phrases, it's now possible for a covered_concept to include concepts where phrases are now absent (""). // Such phrases should be skipped from the selection process.
		if (!random_concept.phrases || random_concept.phrases.length == 0) {
			cur_attempt++;
			continue;
		}
		let random_phrase = getRandomPhraseInConcept(random_concept);
		if (!random_phrase) {
			cur_attempt++;
			continue;
		}
		if (!choices.includes(random_phrase)) {
			choices.push(random_phrase);
		}
		if (choices.length >= 3) break;
		cur_attempt++;
	}
	return choices;
}

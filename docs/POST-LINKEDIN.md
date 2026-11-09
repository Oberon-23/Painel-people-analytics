# Post para o LinkedIn

Imagem: `docs/img/linkedin.png` (1200 × 1200). Troque os dois links antes de publicar.

---

Hoje muita gente apresenta dados em HTML. E a pergunta que sempre aparece nos comentários é: e a segurança?

Montei um projeto para responder isso na prática: um painel de RH (turnover, absenteísmo, clima e igualdade salarial) de uma empresa fictícia, em que o banco de dados decide o que cada pessoa vê.

A mesma consulta, sem filtro nenhum, devolve:
→ 521 registros para a diretora de RH
→ 342 para o HR Business Partner (só a diretoria dele)
→ 155 para a gerente (só a equipe dela)
→ 0 para o analista (que só trabalha com números de grupos)

A tela não esconde nada. Ela simplesmente não recebe.

O que está por trás:
🔒 Linha: Row Level Security no PostgreSQL
🔒 Coluna: salário e CPF só saem para quem pode, e o CPF sai mascarado
🔒 Grupo: médias de grupos com menos de 5 pessoas ficam ocultas, porque revelariam alguém
🔒 Rastro: todo acesso a dado pessoal fica registrado, e o aplicativo não consegue apagar o registro

E tem uma página que roda, ao vivo, 10 tentativas de burlar as regras: ler salário direto da tabela, trocar o usuário da sessão, apagar a auditoria... Todas barradas pelo banco.

O que levo para qualquer painel, seja em HTML ou em Power BI: segurança não é esconder coluna na tela. É decidir onde o dado fica e quem pode recebê-lo.

Stack: PostgreSQL, Next.js e TypeScript. Dados 100% fictícios.

🔗 Teste com os 4 perfis: [LINK DA VERCEL]
💻 Código: [LINK DO GITHUB]

#PeopleAnalytics #LGPD #SegurancaDaInformacao #PostgreSQL #AnaliseDeDados

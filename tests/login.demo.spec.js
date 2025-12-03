import { test, expect } from '@playwright/test';
// Remova esta linha, ela não é necessária:
// import { TIMEOUT } from 'dns'; 

test('Demo Login Test 1', async({page}) =>{
    
    await page.goto('https://sinan.saude.gov.br/sinan/login/login.jsf');
    await page.locator('[id="form:username"]').fill('lucas.ferreira@sesma');
    await page.locator('[id="form:password"]').fill('lucas19');
    
    // Clica no botão de login
    await page.pause();
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('[class="botao"]')).toBeVisible();
    await page.locator('[class="botao"]').press('Enter');
    
    // Espera a página carregar após o login
    await page.waitForLoadState('domcontentloaded');
    
    // Exportação e Solicitar

    // Garante que o elemento esteja visível antes de prosseguir (seletor corrigido)
    await expect(page.locator('[id="barraMenu:j_id52_span"]')).toBeVisible();
    await page.locator('[id="barraMenu:j_id52_span"]').click();
    
    await expect(page.locator('[id="barraMenu:j_id53:anchor"]')).toBeVisible();
    await page.locator('[id="barraMenu:j_id53:anchor"]').click();    

    // --- 3. Preencher Data Inicial e Data Final ---
    // Data inicial fixa
    await page.evaluate(() => {
    // nada aqui: executaremos com IDs específicos
    });

    // usar evaluate para setar o valor direto (mesmo que o campo seja um datepicker)
    await page.evaluate(() => {
        const el = document.getElementById('form:consulta_dataInicialInputDate');
        if (el) el.value = '01/01/2025';
    });

    // data final -> hoje
    const hoje = new Date();
    const dd = String(hoje.getDate()).padStart(2, '0');
    const mm = String(hoje.getMonth() + 1).padStart(2, '0');
    const yyyy = hoje.getFullYear();
    const dataHojeStr = `${dd}/${mm}/${yyyy}`;

    await page.evaluate((valor) => {
        const el = document.getElementById('form:consulta_dataFinalInputDate');
        if (el) el.value = valor;
    }, dataHojeStr);
    await page.pause();
     // --- 4. Selecionar "Notificação ou Residência" no select com id 'form:tipoUf' ---
     await page.locator('[id="form:tipoUf"]').selectOption('3');
      // --- 5. exportar dados do paciente ---
     await page.locator('[name="form:j_id124"]').click();
     // --- 6. solicitar ---
     await page.locator('[id="form:j_id128"]').click();
     
    // espera a mensagem de sucesso e captura o número
    // procurar por um span que contenha "Número:"
    const sucessoSpan = page.locator('xpath=//span[contains(text(), "Número:")]');
    await sucessoSpan.waitFor({ state: 'visible', timeout: 15000 });
    const numeroIdentificado = (await sucessoSpan.textContent()) || '';
    // limpar: "Número: 1.234"
    let numeroOriginal = numeroIdentificado.replace('Número:', '').trim();
    numeroOriginal = numeroOriginal.replace(/\./g, ''); // remover pontos caso existam

    console.log('Número da solicitação:', numeroOriginal);

    // --- 7. Ir para Menu Exportação -> Consultar exportação ---
    await page.locator('[id="barraMenu:j_id52_span"]').click();
    await page.waitForSelector('[id="barraMenu:j_id56:anchor"]',{timeout:5000});
    await page.locator('[id="barraMenu:j_id56:anchor"]').click();
      // --- 9. Procurar na tabela pela linha com o número e clicar em "Baixar arquivo DBF" ---
    const linhas = page.locator('table.rich-table tbody tr');
    const count = await linhas.count();
    console.log(`linhas encontradas: ${count}`);

    let baixou = false;
    for (let i = 0; i < count; i++) {
        const linha = linhas.nth(i);
        // o número estava em td[1]/center no selenium
        const numeroElemento = linha.locator('xpath=./td[1]/center');
        const numeroLinha = (await numeroElemento.textContent())?.trim() || '';

        console.log(`➡️ Linha ${i}: ${numeroLinha}`);

        if (numeroLinha === numeroOriginal) {
            console.log(`✅ Número encontrado na linha ${i}. Iniciando download...`);
            // procurar o link "Baixar arquivo DBF" dentro dessa linha
            const linkBaixar = linha.locator('xpath=.//a[contains(text(), "Baixar arquivo DBF")]');
            await linkBaixar.waitFor({ state: 'visible', timeout: 10000 });
            // aguardar o evento de download
            const [ download ] = await Promise.all([
            page.waitForEvent('download', { timeout: 30000 }),
            linkBaixar.click()
            ]);

            // salvar em disk (se desejar)
            const path = await download.path();
            // se quiser salvar num local custom:
            // await download.saveAs(`/tmp/${download.suggestedFilename()}`);
            console.log('Download iniciado. filename suggestion:', download.suggestedFilename(), 'path temporary:', path);

            baixou = true;
            break;
        }
    }

    if (!baixou) {
        console.error(`❌ Erro: Solicitação ${numeroOriginal} não encontrada na lista.`);
        throw new Error('Solicitação não encontrada');
    }
        await page.pause();
        await page.pause();
});
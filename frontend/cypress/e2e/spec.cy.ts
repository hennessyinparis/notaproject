describe('Нота smoke', () => {
  it('opens home and discover', () => {
    cy.visit('/');
    cy.contains('Нота', { matchCase: false });
    cy.visit('/discover');
    cy.contains('Открытия');
    cy.contains('В тренде');
  });

  it('login page has forgot password link', () => {
    cy.visit('/login');
    cy.contains('Забыли пароль?');
  });
});
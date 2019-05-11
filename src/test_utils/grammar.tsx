// TODO: load this from grammar.ohm instead of duplicating it
export const ohmGrammar = '\
  Formula {\n\
    Exp\n\
      = LambdaExp\n\
  \n\
    LambdaExp\n\
      = ident "->" Exp  -- lambda\n\
      | AndOrExp\n\
  \n\
    AndOrExp\n\
      = AndOrExp "&" EqExp  -- and\n\
      | AndOrExp "|" EqExp  -- or\n\
      | EqExp\n\
  \n\
    EqExp\n\
      = EqExp "=="  RelExp  -- eq\n\
      | EqExp "!=" RelExp   -- neq\n\
      | RelExp\n\
  \n\
    RelExp\n\
      = RelExp "<" AddExp   -- lt\n\
      | RelExp "<=" AddExp  -- lte\n\
      | RelExp ">" AddExp   -- gt\n\
      | RelExp ">=" AddExp  -- gte\n\
      | AddExp\n\
  \n\
    AddExp\n\
      = AddExp "+" MulExp  -- plus\n\
      | AddExp "-" MulExp  -- minus\n\
      | MulExp\n\
  \n\
    MulExp\n\
      = MulExp "*" UnaryOpExp  -- times\n\
      | MulExp "/" UnaryOpExp  -- divide\n\
      | MulExp "%" UnaryOpExp  -- mod\n\
      | UnaryOpExp\n\
  \n\
    UnaryOpExp\n\
      = "!" UnaryOpExp  -- not\n\
      | "-" UnaryOpExp  -- negate\n\
      | IndexExp\n\
  \n\
    IndexExp\n\
      = IndexExp #"[" Exp "]"  -- index\n\
      | IndexExp #"." #ident   -- project\n\
      | CallExp\n\
  \n\
    CallExp\n\
      = ident #"(" ListOf<Assignment, ","> ")"  -- call\n\
      | IdentExp\
  \n\
    Assignment\n\
      = ident "=" Exp\n\
  \n\
    IdentExp\n\
      = ident  -- ident\n\
      | GroupExp\n\
  \n\
    GroupExp\n\
      = "(" Exp ")"               -- parens\n\
      | "[" ListOf<Exp, ","> "]"  -- list\n\
      | primitive\n\
  \n\
  \n\
    // Lexical rules\n\
  \n\
    primitive\n\
      = number   -- number\n\
      | boolean  -- boolean\n\
      | string   -- string\n\
  \n\
    number\n\
      = digit+ ("." digit+)?\n\
  \n\
    boolean\n\
      = trueK   -- true\n\
      | falseK  -- false\n\
  \n\
    trueK\n\
      = "true" ~identChar\n\
  \n\
    falseK\n\
      = "false" ~identChar\n\
  \n\
    string\n\
      = "\\\"" stringChar+ "\\\""\n\
  \n\
    stringChar\n\
      = ~stringReservedChar any  -- char\n\
      | "\\\\" any                 -- escaped\n\
  \n\
    stringReservedChar\n\
      = "\\\\"\n\
      | "\\\""\n\
  \n\
    ident\n\
      = unquotedIdent  -- unquoted\n\
      | quotedIdent    -- quoted\n\
  \n\
    unquotedIdent\n\
      = ~keyword letter identChar*\n\
  \n\
    identChar\n\
      = alnum\n\
      | "_"\n\
  \n\
    quotedIdent\n\
      = "\'" quotedIdentChar+ "\'"\n\
  \n\
    quotedIdentChar\n\
      = ~quotedIdentReservedChar any  -- char\n\
      | "\\\\" any                      -- escaped\n\
  \n\
    quotedIdentReservedChar\n\
      = "\\\\"\n\
      | "\'"\n\
  \n\
    keyword\n\
      = trueK | falseK\n\
  }';
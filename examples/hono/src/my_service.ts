const currentDate = new Date()

export class MyService {
  doSomeBusinessLogic() {
    console.log('Hello from MyService')
    return currentDate.toString()
  }
}
